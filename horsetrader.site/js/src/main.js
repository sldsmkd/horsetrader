import "../../css/styles.css";

// Minimal smoke test of the ETL → site data bridge: load the static bundle
// the ETL bakes into static/json/ (served at /json) and show that it's wired up.
async function main() {
  const app = document.querySelector("#app");

  try {
    const [academy, events] = await Promise.all([
      fetch("/json/academy.json").then((r) => r.json()),
      fetch("/json/events.json").then((r) => r.json()),
    ]);

    const size = (v) => (Array.isArray(v) ? v.length : Object.keys(v ?? {}).length);
    const counts = {
      Characters: size(academy.characters),
      Supports: size(academy.supports),
      Trainees: size(academy.trainees),
      Events: size(events.events),
    };

    app.innerHTML = `
      <h1>Horsetrader</h1>
      <p>Data bundle loaded from <code>/json</code>.</p>
      <ul class="counts">
        ${Object.entries(counts)
          .map(([label, n]) => `<li><strong>${n}</strong>${label}</li>`)
          .join("")}
      </ul>
    `;
  } catch (err) {
    app.innerHTML = `<p>Failed to load data: ${err.message}</p>`;
  }
}

main();
