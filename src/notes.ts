import './wardrobe.css';
import './notes.css';
import * as bridge from './platform/bridge.ts';

const form = document.getElementById('add') as HTMLFormElement;
const input = document.getElementById('text') as HTMLInputElement;
const list = document.getElementById('list') as HTMLUListElement;
const empty = document.getElementById('empty') as HTMLElement;

let notes: bridge.Note[] = [];

const when = new Intl.DateTimeFormat('nl', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function save(): Promise<void> {
  await bridge.setNotes(notes);
  draw();
}

/** Open notes first (newest on top), then the ticked-off ones. */
function draw(): void {
  list.replaceChildren();
  const sorted = [...notes].sort((a, b) => Number(a.done) - Number(b.done) || b.id - a.id);
  for (const note of sorted) {
    const li = document.createElement('li');
    li.classList.toggle('done', note.done);
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: note.done });
    box.setAttribute('aria-label', 'Klaar');
    box.addEventListener('change', () => {
      note.done = box.checked;
      void save();
    });
    const text = Object.assign(document.createElement('span'), { textContent: note.text });
    const time = Object.assign(document.createElement('time'), { textContent: when.format(note.id) });
    const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '×', title: 'Weggooien' });
    remove.setAttribute('aria-label', 'Weggooien');
    remove.addEventListener('click', () => {
      notes = notes.filter((n) => n.id !== note.id);
      void save();
    });
    li.append(box, text, time, remove);
    list.append(li);
  }
  empty.hidden = notes.length > 0;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  notes.push({ id: Date.now(), text, done: false });
  input.value = '';
  void save();
});

bridge
  .getNotes()
  .then((loaded) => {
    notes = loaded;
    draw();
  })
  .catch((e) => bridge.log(`notities: ${String(e)}`));
