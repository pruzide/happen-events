fetch('/api/config').then(response => response.json()).then(data => {
  if (!data.contactEmail) return;
  const p = document.querySelector('#privacyContact');
  const a = document.createElement('a');
  a.href = `mailto:${data.contactEmail}`;
  a.textContent = data.contactEmail;
  p.replaceChildren(document.createTextNode('For privacy and deletion requests: '), a);
}).catch(() => {});
