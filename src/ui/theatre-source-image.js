/** Display a credited source image, falling back to the film's own frame. */
export function createSourceImage(record, { className = '', lazy = true, onDisplay } = {}) {
  const photo = document.createElement('img');
  photo.className = className;
  photo.alt = '';
  photo.decoding = 'async';
  photo.loading = lazy ? 'lazy' : 'eager';
  photo.referrerPolicy = 'no-referrer';
  const choices = [record.image, record.frame].filter(Boolean);
  let index = 0;
  function requestImage() {
    const art = choices[index];
    if (!art) {
      photo.remove();
      onDisplay?.(null);
      return;
    }
    if (art.width && art.height) { photo.width = art.width; photo.height = art.height; }
    photo.src = art.url;
  }
  photo.addEventListener('load', () => {
    photo.classList.add('is-ready');
    onDisplay?.(choices[index]);
  });
  photo.addEventListener('error', () => { index++; requestImage(); });
  requestImage();
  return photo;
}

export function setImageCredit(link, art, label) {
  link.hidden = !art;
  if (art) {
    link.href = art.sourceUrl;
    link.textContent = label(art.credit);
  } else {
    link.removeAttribute('href');
    link.textContent = '';
  }
}

/** Update a native player's poster without replacing its video or its source. */
export function createVideoPoster(video, credit, label) {
  let current = null;
  return (record) => {
    if (current === record) return;
    current = record;
    video.removeAttribute('poster');
    setImageCredit(credit, null, label);
    if (record?.image) createSourceImage(record, { lazy: false, onDisplay(art) {
      if (record !== current || !art) return;
      video.poster = art.url;
      setImageCredit(credit, art, label);
    } });
  };
}
