(() => {
  const $ = s => document.querySelector(s);
  const dialog = $('#demo-dialog'), content = dialog.querySelector('.dialog-content');
  let toastTimer, photoIndex = 0;
  const photos = [...document.querySelectorAll('.listing-photo')].map(el => ({src:el.src,alt:el.alt}));
  function toast(message) {
    $('#toast').textContent = message; $('#toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2800);
  }
  function modal(title, body) {
    content.replaceChildren();
    const h = document.createElement('h2'); h.textContent = title; content.append(h);
    if (typeof body === 'string') { const p = document.createElement('p'); p.textContent = body; content.append(p); }
    else content.append(body);
    dialog.showModal();
  }
  function showPhoto(index) {
    const p = photos[((index % photos.length) + photos.length) % photos.length];
    const image = new Image(); image.src = p.src; image.alt = p.alt; image.className = 'dialog-photo';
    modal(p.alt, image);
  }
  function gallery(step) {
    const track = $('.gallery-track');
    photoIndex = (photoIndex + step + photos.length) % photos.length;
    const item = track.children[photoIndex];
    track.scrollTo({left:item.offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  document.addEventListener('click', async e => {
    const photo = e.target.closest('[data-photo]');
    if (photo) { showPhoto(Number(photo.dataset.photo)); return; }
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    const action = btn.dataset.action;
    switch(action) {
      case 'snow': break;
      case 'prev': gallery(-1); break;
      case 'next': gallery(1); break;
      case 'favorite': {
        const selected = btn.getAttribute('aria-pressed') !== 'true';
        document.querySelectorAll('[data-action="favorite"]').forEach(b => {b.setAttribute('aria-pressed', String(selected));b.style.background=selected?'#e5f8ec':'';});
        toast(selected?'Квартира сохранена в избранном':'Квартира удалена из избранного'); break;
      }
      case 'compare': btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed')!=='true'));toast('Квартира добавлена к сравнению в прототипе');break;
      case 'copy': {
        const text = matchMedia('(max-width:1023px)').matches ? 'Москва, Новогиреевская улица, 17 / 14 Федеративный проспект, 1' : 'Москва, Новогиреевская улица, 172 / 142 Федеративный проспект, 123';
        try {await navigator.clipboard.writeText(text);toast('Адрес скопирован');}catch{modal('Адрес квартиры',text);}break;
      }
      case 'share': modal('Поделиться квартирой','Это локальная демонстрация страницы. Ссылка на прототип: '+location.href);break;
      case 'flat': $('.gallery-track').scrollTo({left:0,behavior:'smooth'}); photoIndex=0;break;
      case 'house': showPhoto(0);break;
      case 'plan': modal('Планировка','В предоставленных макетах отдельного изображения планировки нет. Здесь показана демонстрация кнопки галереи.');break;
      case 'description': {
        const expanded = $('.description-copy').classList.toggle('expanded');btn.textContent=expanded?'Свернуть':'Читать далее';break;
      }
      case 'chip': document.querySelectorAll('.map-chip').forEach(c=>c.classList.remove('selected'));btn.classList.add('selected');toast('На карте выбрано: '+btn.textContent);break;
      case 'question': {
        document.querySelectorAll('.question-chip').forEach(c=>c.classList.remove('selected'));btn.classList.add('selected');
        $('.question-form textarea').value='Здравствуйте! '+btn.textContent;$('.counter').textContent=$('.question-form textarea').value.length+'/100';break;
      }
      case 'send': toast('Демонстрация: сообщение не отправлено продавцу');break;
      case 'phone': modal('Контакт с продавцом','В локальном прототипе звонки отключены. Настоящий номер продавца не используется.');break;
      case 'chat': case 'contact': {
        const wrapper = document.createElement('div'), text = document.createElement('p'), input=document.createElement('textarea'), send=document.createElement('button');
        text.textContent='Демонстрационный чат с Алексеем Сергеевым';input.placeholder='Напишите сообщение';input.setAttribute('aria-label','Сообщение');send.textContent='Отправить';send.className='primary';send.type='button';send.onclick=()=>toast('Демонстрация: сообщение не отправлено продавцу');wrapper.append(text,input,send);modal('Сообщение продавцу',wrapper);break;
      }
      case 'map': {const p = document.createElement('div'), image = new Image();image.src='assets/map-touch.png';image.alt='Карта из макета Figma';image.style.width='100%';const t=document.createElement('p');t.textContent='Москва, район квартиры. Интерактивная карта в этом локальном прототипе не подключена.';p.append(image,t);modal('Что рядом?',p);break;}
      case 'history': modal('История цены','Стоимость из макета: '+(matchMedia('(max-width:1023px)').matches?'25 500 000 ₽':'22 500 000 ₽')+'. История изменений в макете не представлена.');break;
      case 'mortgage': modal('Параметры из макета','Доступно в ипотеку: 18 000 000 ₽. Первый взнос: 4 500 000 ₽. Это демонстрация интерфейса, без оформления заявки.');break;
      case 'more': modal('Характеристики квартиры','Площадь: 42 м². Жилая: 35 м². Кухня: 12 м². Ремонт: евро. Дом 1957 года, кирпичный, высота потолков 3 м, 3 лифта.');break;
      case 'building': modal('О доме','Кирпичный дом, 1957 год постройки. Высота потолков 3 м, 3 лифта.');break;
      default: toast('Раздел «'+(btn.textContent.trim()||btn.getAttribute('aria-label'))+'» — демонстрация');
    }
  });
  document.addEventListener('keydown', e => { if ((e.key==='Enter'||e.key===' ') && e.target.matches('[data-photo]')) {e.preventDefault();showPhoto(Number(e.target.dataset.photo));} });
  $('.question-form').addEventListener('submit',e=>e.preventDefault());
  $('.question-form textarea').addEventListener('input',e=>$('.counter').textContent=e.target.value.length+'/100');
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
})();
