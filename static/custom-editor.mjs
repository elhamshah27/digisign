import { CUSTOM_DEFAULT, normalizeCustom } from "./weather-core.mjs";

// A draft is separate from the active widget. Cancel never overwrites a saved design.
export function createCustomEditor({ onPreview, onApply, onCancel }) {
  const $ = (id) => document.getElementById(id);
  const panel = $("custom-editor");
  let draft = null,
    history = [],
    step = 0;
  const names = [
    "Choose a look",
    "Choose what to show",
    "Make it easy to read",
  ];
  const feedback = (text) => {
    $("editor-feedback").textContent = text;
  };

  function sync() {
    panel.querySelectorAll('[name="custom-color"]').forEach((el) => {
      el.checked = el.value === draft.background;
    });
    $("custom-color-picker").value = draft.background;
    if ($("custom-title").value !== draft.title)
      $("custom-title").value = draft.title;
    panel.querySelectorAll('[name="custom-layout"]').forEach((el) => {
      el.checked = el.value === draft.layout;
    });
    panel.querySelectorAll('[name="custom-size"]').forEach((el) => {
      el.checked = el.value === draft.textSize;
    });
    $("custom-icon").checked = draft.showIcon;
    $("custom-feels").checked = draft.showFeelsLike;
    $("custom-highlow").checked = draft.showHighLow;
    $("undo-custom").disabled = history.length === 0;
  }
  function showStep(focus = true) {
    panel.querySelectorAll("[data-step]").forEach((el, index) => {
      el.hidden = index !== step;
    });
    panel.querySelectorAll(".step-track span").forEach((el, index) => {
      el.classList.toggle("complete", index <= step);
    });
    $("step-status").textContent = `Step ${step + 1} of 3 · ${names[step]}`;
    $("previous-step").hidden = step === 0;
    $("next-step").hidden = step === 2;
    $("next-step").textContent =
      step === 0 ? "Next: choose details →" : "Next: text size →";
    $("apply-custom").hidden = step !== 2;
    if (focus) panel.querySelector(`[data-step="${step}"] h3`).focus();
  }
  function update(patch, { syncControls = true } = {}) {
    const next = normalizeCustom({ ...draft, ...patch });
    if (JSON.stringify(next) === JSON.stringify(draft)) return;
    history.push({ ...draft });
    if (history.length > 80) history.shift();
    draft = next;
    if (syncControls) sync();
    else $("undo-custom").disabled = false;
    feedback("Preview updated.");
    onPreview({ ...draft });
  }
  panel
    .querySelectorAll('[name="custom-color"]')
    .forEach((el) =>
      el.addEventListener("change", () => update({ background: el.value })),
    );
  // A native color picker sends one committed change; one Undo restores the previous color.
  $("custom-color-picker").addEventListener("change", (event) =>
    update({ background: event.target.value }),
  );
  $("custom-title").addEventListener("input", (event) =>
    update({ title: event.target.value }, { syncControls: false }),
  );
  panel
    .querySelectorAll('[name="custom-layout"]')
    .forEach((el) =>
      el.addEventListener("change", () => update({ layout: el.value })),
    );
  panel
    .querySelectorAll('[name="custom-size"]')
    .forEach((el) =>
      el.addEventListener("change", () => update({ textSize: el.value })),
    );
  for (const [id, key] of [
    ["custom-icon", "showIcon"],
    ["custom-feels", "showFeelsLike"],
    ["custom-highlow", "showHighLow"],
  ]) {
    $(id).addEventListener("change", (event) =>
      update({ [key]: event.target.checked }),
    );
  }
  $("previous-step").addEventListener("click", () => {
    step--;
    showStep();
  });
  $("next-step").addEventListener("click", () => {
    step++;
    showStep();
  });
  $("undo-custom").addEventListener("click", () => {
    if (!history.length) return;
    draft = history.pop();
    sync();
    onPreview({ ...draft });
    feedback("Last change undone.");
  });
  $("reset-custom").addEventListener("click", () => {
    const changed =
      JSON.stringify(draft) !== JSON.stringify(normalizeCustom(CUSTOM_DEFAULT));
    update(CUSTOM_DEFAULT);
    step = 0;
    showStep();
    feedback(
      changed
        ? "Started over. Use Undo to bring your design back."
        : "You are already at the starting design.",
    );
  });
  $("cancel-custom").addEventListener("click", () => onCancel());
  $("apply-custom").addEventListener("click", () =>
    onApply(normalizeCustom(draft)),
  );
  return {
    open(custom) {
      draft = normalizeCustom(custom);
      history = [];
      step = 0;
      panel.hidden = false;
      sync();
      showStep();
      feedback("");
      onPreview({ ...draft });
    },
    close() {
      panel.hidden = true;
      draft = null;
      history = [];
    },
  };
}
