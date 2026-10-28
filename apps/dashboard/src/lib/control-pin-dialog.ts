let pending: Promise<string | null> | null = null;

/** Accessible, masked confirmation that also works in browsers without window.prompt. */
export function requestControlPin(): Promise<string | null> {
  if (pending) return pending;
  pending = new Promise<string | null>((resolve) => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement("dialog");
    dialog.className = "rounded-2xl border border-white/20 bg-[#111820] p-6 text-white shadow-2xl backdrop:bg-black/70";
    dialog.setAttribute("aria-labelledby", "control-pin-heading");
    const form = document.createElement("form");
    form.method = "dialog";
    const heading = document.createElement("h2");
    heading.id = "control-pin-heading";
    heading.textContent = "Confirm administrator access";
    heading.className = "mb-2 text-xl font-semibold";
    const description = document.createElement("p");
    description.textContent = "Re-enter your six-digit PIN to confirm this action.";
    description.className = "mb-5 text-sm text-gray-300";
    const label = document.createElement("label");
    label.textContent = "Administrator PIN";
    label.className = "block text-sm";
    const input = document.createElement("input");
    input.type = "password";
    input.inputMode = "numeric";
    input.pattern = "[0-9]{6}";
    input.minLength = 6;
    input.maxLength = 6;
    input.required = true;
    input.autocomplete = "current-password";
    input.className = "mt-2 block w-full rounded-lg border border-white/30 bg-black/30 px-4 py-3 text-lg tracking-widest";
    label.append(input);
    const actions = document.createElement("div");
    actions.className = "mt-6 flex justify-end gap-3";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.className = "rounded-lg border border-white/30 px-4 py-2";
    cancel.onclick = () => dialog.close();
    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.value = "confirm";
    confirm.textContent = "Confirm action";
    confirm.className = "rounded-lg bg-[#ff9d63] px-4 py-2 font-semibold text-black";
    actions.append(cancel, confirm);
    form.append(heading, description, label, actions);
    dialog.append(form);
    dialog.addEventListener("close", () => {
      const pin = dialog.returnValue === "confirm" ? input.value : null;
      input.value = "";
      dialog.remove();
      previousFocus?.focus();
      resolve(pin);
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  }).finally(() => { pending = null; });
  return pending;
}
