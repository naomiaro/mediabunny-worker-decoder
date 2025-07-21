import Worker from './worker?worker';

const worker = new Worker();

const input = document.createElement('input');
input.type = 'file';
document.body.appendChild(input);

worker.onmessage = (e) => {
  console.log('Metadata from worker:', e.data);
};

input.onchange = async (e) => {
  const file = e.target.files[0];
  console.log('Received file')
  console.log(file)
  const buffer = await file.arrayBuffer();
  console.log(buffer)
  worker.postMessage(buffer, [buffer]);
};
