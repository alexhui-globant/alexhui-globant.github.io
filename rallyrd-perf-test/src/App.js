import { useState } from "react";
import runPerfTest from "./runPerfTest";

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState();
  const run = async () => {
    setIsRunning(true);
    setResults(undefined);
    const perfResults = await runPerfTest();
    setResults(perfResults);
    setIsRunning(false);
  };

  return (
    <header>
      <div>Rally Rd Performance Test</div>
      <button onClick={run} disabled={isRunning}>Run</button>
      {results && 
        <div>
          <div>{results.message}</div>
          <pre>{JSON.stringify(results.data, undefined, 2)}</pre>
        </div>
      }
    </header>
  );
}

export default App;
