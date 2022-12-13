const runPerfTest = async () => {
    console.log('rallyd-perf-test: runPerfTest()');
    return new Promise(
        (resolve, reject) => {
            try {
                setTimeout(() => { resolve({message: "Perf Test Completed!"}) }, 3000);
            } catch(e) {
                reject({message: e.message});
            }
        });
    }

export default runPerfTest;
