import { useState } from "react";
import runPerfTest from "./runPerfTest";

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState();
  const run = async () => {
    setIsRunning(true);
    setMessage('');
    const perfResults = await runPerfTest();
    setMessage(perfResults.message);
    setIsRunning(false);
  };

  return (
    <header>
      <div>Rally Rd Performance Test</div>
      <button onClick={run} disabled={isRunning}>Run</button>
      <div>{message}</div>
    </header>
  );
}

export default App;
