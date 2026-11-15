const panel = document.getElementById('missions-panel');
const trigger = document.getElementById('missions-open');
const closeButton = document.getElementById('missions-close');

trigger.addEventListener('click', () => {
  if (panel.open) return;
  panel.showModal();
  trigger.setAttribute('aria-expanded', 'true');
  closeButton.focus({ preventScroll: true });
});

closeButton.addEventListener('click', () => panel.close());

// Escape usa o fechamento nativo do dialog. Todos os caminhos devolvem o foco.
panel.addEventListener('close', () => {
  trigger.setAttribute('aria-expanded', 'false');
  trigger.focus({ preventScroll: true });
});

panel.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...panel.querySelectorAll('button, a[href], summary, [tabindex="0"]')]
    .filter(element => !element.disabled && element.getClientRects().length > 0);
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

// Fechar ao clicar no fundo, sem confundir cliques na área interna do painel.
let backdropPressed = false;
const outside = event => {
  const bounds = panel.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
};
panel.addEventListener('pointerdown', event => { backdropPressed = event.target === panel && outside(event); });
panel.addEventListener('click', event => {
  if (backdropPressed && event.target === panel && outside(event)) panel.close();
  backdropPressed = false;
});
