/* Terminating a worker cancels a run; results carry their full configuration. */
importScripts("core.js");
onmessage = ({ data }) => {
  try {
    const result = CausalScience.simulation(data, (n) =>
      postMessage({ type: "progress", n }),
    );
    postMessage({ type: "result", result });
  } catch (error) {
    postMessage({ type: "error", message: error.message });
  }
};
