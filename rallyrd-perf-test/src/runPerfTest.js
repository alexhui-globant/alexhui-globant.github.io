/** Returns the data of the api/client-screens/home endpoint. */
async function requestBackendHome() {
    const response = await fetch('https://api.dev.rallyrd.com/api/client-screens/home');
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}, message '${response.message}'`);
    }
    return response.json();
}

/**
 * Takes the response data from the home endpoint and extracts the URLs of media into a structure looking like:
 * `{ bannerMedia: ['<url1>', '<url2>', ...], carouselMedia: ['<url1>', '<url2>', ...], heroMedia: ['<url1>'] }`
 */
function extractMediaFromHome(homeData, itemTransformFn) {
    // Extract banner media
    const bannerMedia = homeData.sections.banners?.length > 0
        ? homeData.sections.banners.map(item => item.items[0].content.image.link)
        : [];

    // Extract carousel media
    const carouselMedia = homeData.sections.carouselsV2?.length > 0
        ? homeData.sections.carouselsV2.flatMap(
            carousel => carousel.items.map(
                item => homeData.data.assets.find(dataItem => dataItem.id === item.assetId).portalImage))
        : [];

    // Extract hero media
    const heroMedia = homeData.sections?.hero_asset?.id
        // TODO when the hero asset is added to the `data` section of the response.
        // ? [homeData.data.assets.find((item => item.id === homeData.sections.hero_asset.id))?.heroMedia]
        ? [homeData.sections.hero_asset.heroMedia]
        : [];

    return { bannerMedia, carouselMedia, heroMedia };
}

/**
 * Converts each media URL from the CDN URL to the S3 URL.  Works for the dev, staging and production environments.
 */
function transformMediaToS3Urls(mediaDictionary) {
    const convertItemToS3Url = item =>
        item.replace('media.dev.rallyrd.com', 'share-media-applications-dev-rallyrd.s3.amazonaws.com')
            .replace('media.staging.rallyrd.com', 'share-media-applications-staging-rallyrd.s3.amazonaws.com')
            .replace('media.production.rallyrd.com', 'share-media-applications-production-rallyrd.s3.amazonaws.com');
    ;
    return {
        bannerMedia: mediaDictionary.bannerMedia.map(convertItemToS3Url),
        carouselMedia: mediaDictionary.carouselMedia.map(convertItemToS3Url),
        heroMedia: mediaDictionary.heroMedia.map(convertItemToS3Url)
    }
}

async function fetchAllMedia(mediaDictionary) {
    const fetchMediaItem = item => fetch(item, {mode: 'no-cors'});

    const fetches = [];
    fetches.push(...mediaDictionary.bannerMedia.map(bannerMediaItem => fetchMediaItem(bannerMediaItem)));
    fetches.push(...mediaDictionary.carouselMedia.map(carouselMediaItem => fetchMediaItem(carouselMediaItem)));
    fetches.push(...mediaDictionary.heroMedia.map(heroMediaItem => fetchMediaItem(heroMediaItem)));
    await Promise.all(fetches);
}

/**
 * Runs multiple trials and collects the aggregate measurements as well as the individual trial measurements.
 * @returns `{ allTrialsMs: <number>, trialsMs: [<number>, <number>, ...]}`
 */
async function runTrials(mediaDictionary, numTrials, trialName) {
    // Declare labels for tracking performance
    const allTrialsLabel = `${trialName}All${numTrials}Trials`;
    const trialLabel = (trialNum) => `${trialName}Trial${trialNum}`;

    // Run trials
    performance.mark(`${allTrialsLabel}Start`);
    for (let i = 0; i < numTrials; i++) {
        performance.mark(`${trialLabel(i)}Start`);
        await fetchAllMedia(mediaDictionary);
        performance.mark(`${trialLabel(i)}End`);
    }
    performance.mark(`${allTrialsLabel}End`);

    // Collect metrics
    const allTrialsMeasure = performance.measure(allTrialsLabel, `${allTrialsLabel}Start`, `${allTrialsLabel}End`);
    const trialMeasures = [];
    for (let i = 0; i < numTrials; i++) {
        trialMeasures.push(performance.measure(`${trialLabel(i)}`, `${trialLabel(i)}Start`, `${trialLabel(i)}End`));
    }
    performance.clearMarks();
    performance.clearMeasures();
    return {
        allTrialsMs: allTrialsMeasure.duration,
        trialsMs: trialMeasures.map(tm => tm.duration),
        averageMs: allTrialsMeasure.duration / numTrials
    };
}

const runPerfTest = async () => {
    const NUM_TRIAL_RUNS = 5;
    console.log('Testing started');

    const homeData = await requestBackendHome();
    console.log(homeData);

    console.log(`Testing CDN...`);
    const mediaDictionary = extractMediaFromHome(homeData);
    console.log(mediaDictionary);
    const cdnMeasures = await runTrials(mediaDictionary, NUM_TRIAL_RUNS, 'CDN');
    console.log(cdnMeasures);

    console.log(`Testing S3...`);
    const s3MediaDictionary = transformMediaToS3Urls(mediaDictionary);
    console.log(s3MediaDictionary);
    const s3Measures = await runTrials(s3MediaDictionary, NUM_TRIAL_RUNS, 'S3');
    console.log(s3Measures);

    // Compose reply
    const timeReduction = (old, newValue) => (old - newValue) / old * 100;
    const performanceIncrease = (old, newValue) => (old - newValue) / newValue * 100;
    const fasterByMultiple = (old, newValue) => old/newValue;
    const summary = {
        cdn: cdnMeasures,
        s3: s3Measures,
        comparisons: {
            diffs: {
                allTrialsMs: s3Measures.allTrialsMs - cdnMeasures.allTrialsMs,
                trialsMs: s3Measures.trialsMs.map((t, i) => t - cdnMeasures.trialsMs[i]),
                averageMs: s3Measures.averageMs - cdnMeasures.averageMs,
            },
            timeReductionPercent: {
                allTrials: timeReduction(s3Measures.allTrialsMs, cdnMeasures.allTrialsMs),
                trials: s3Measures.trialsMs.map((t, i) => timeReduction(t, cdnMeasures.trialsMs[i])),
                average: timeReduction(s3Measures.averageMs, cdnMeasures.averageMs),
            },
            performanceIncreasePercent: {
                allTrials: performanceIncrease(s3Measures.allTrialsMs, cdnMeasures.allTrialsMs),
                trials: s3Measures.trialsMs.map((t, i) => performanceIncrease(t, cdnMeasures.trialsMs[i])),
                average: performanceIncrease(s3Measures.averageMs, cdnMeasures.averageMs),
            },
            fasterByMultiple: {
                allTrials: fasterByMultiple(s3Measures.allTrialsMs, cdnMeasures.allTrialsMs),
                trials: s3Measures.trialsMs.map((t, i) => fasterByMultiple(t, cdnMeasures.trialsMs[i])),
                average: fasterByMultiple(s3Measures.averageMs, cdnMeasures.averageMs),
            },
        }
    }
    console.log(summary);
    console.log('Testing ended');
    return {message: 'Test Completed!', data: summary};
}

export default runPerfTest;
