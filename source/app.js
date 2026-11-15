/* Tənzimləmələr */
const RELEASE_TEXT = "Noyabrın sonu";
const STOCK_TEXT = "100 ədəd";
const RELEASE_DATE = ""; // Dəqiq vaxt məlumdursa, Bakı saatı ilə ISO tarixi yaz.
const ENDPOINT = "/api/waitlist";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const root = document.documentElement;
const $ = (selector) => document.querySelector(selector);
$("#stock").textContent = STOCK_TEXT;
$("#countdown").textContent = RELEASE_TEXT;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const motionAllowed = () => !reducedMotion.matches && !root.classList.contains("motion-paused");
const theme = getComputedStyle(root);
const accent = theme.getPropertyValue("--accent").trim();

/* Açılış, hərflər və hərəkət seçimi */
const boot = $(".boot");
const motionButton = $(".motion-toggle");
function revealLetters(node, baseDelay, step) {
  const letters = [...node.textContent].map((letter, index) => {
    if (letter === " ") return document.createTextNode(" ");
    const glyph = document.createElement("i");
    glyph.textContent = letter;
    glyph.style.animationDelay = (baseDelay + index * step) + "ms";
    return glyph;
  });
  node.replaceChildren(...letters);
}

let firstVisit = true;
try {
  firstVisit = !sessionStorage.getItem("land-of-fire:boot");
  sessionStorage.setItem("land-of-fire:boot", "1");
} catch {}

if (motionAllowed()) {
  if (firstVisit) {
    revealLetters($(".boot span"), 100, 54);
    boot.hidden = false;
    setTimeout(() => { boot.hidden = true; }, 1780);
  }
  document.querySelectorAll("#hero-title .line").forEach((line, index) => {
    line.setAttribute("aria-hidden", "true");
    revealLetters(line, (firstVisit ? 1190 : 50) + 130 * index, 47);
  });
}

const reveal = new IntersectionObserver((entries, observer) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.remove("waiting");
    observer.unobserve(entry.target);
  }
}, { threshold: 0.07 });
if (motionAllowed()) {
  document.querySelectorAll(".reveal").forEach((item) => {
    if (item.getBoundingClientRect().top > innerHeight) item.classList.add("waiting");
    reveal.observe(item);
  });
}
document.addEventListener("focusin", (event) => event.target.closest(".waiting")?.classList.remove("waiting"));

/* Qığılcımlar və parallax */
const hero = $(".hero");
const character = $(".hero-character");
const sun = $(".sun");
const photos = $(".photos");
const cursor = $(".cursor");
const canvas = $("#embers");
const ctx = canvas.getContext("2d");
const sparks = Array.from({ length: 48 }, () => ({
  x: Math.random(), y: Math.random(), speed: 0.04 + Math.random() * .13,
  size: .5 + Math.random() * 1.65, phase: Math.random() * 6.28,
}));
let heroVisible = false;
let width = 0;
let height = 0;
let x = 0;
let y = 0;
let targetX = 0;
let targetY = 0;
let frame = 0;
let last = 0;
let elapsed = 0;

new ResizeObserver(([entry]) => {
  ({ width, height } = entry.contentRect);
  const ratio = Math.min(devicePixelRatio, 1.6);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  queueFrame();
}).observe(hero);

new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  queueFrame();
}).observe(hero);

function queueFrame() {
  if (!frame && motionAllowed() && !document.hidden) frame = requestAnimationFrame(draw);
}

function draw(time) {
  frame = 0;
  if (!motionAllowed() || document.hidden) return;
  const delta = last ? Math.min((time - last) / 1000, .04) : 0;
  last = time;
  elapsed += delta;
  if (heroVisible) {
    x += (targetX - x) * .075;
    y += (targetY - y) * .075;
    character.style.translate = `${x * 18}px ${y * 12}px`;
    sun.style.translate = `${x * -12}px ${y * -9}px`;
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = accent;
      for (const spark of sparks) {
        spark.y = (spark.y - spark.speed * delta + 1) % 1;
        ctx.globalAlpha = .22 + .38 * Math.sin(spark.y * Math.PI);
        ctx.fillRect(spark.x * width + Math.sin(elapsed * .85 + spark.phase) * 13, spark.y * height, spark.size, spark.size * 1.65);
      }
    }
  }
  if (heroVisible) queueFrame();
  else last = 0;
}

document.addEventListener("visibilitychange", () => { last = 0; queueFrame(); });
hero.addEventListener("pointermove", (event) => {
  if (!motionAllowed() || !finePointer.matches || event.pointerType !== "mouse") return;
  const rect = hero.getBoundingClientRect();
  targetX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
  targetY = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
});
hero.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; });

document.addEventListener("pointermove", (event) => {
  if (!motionAllowed() || !finePointer.matches || event.pointerType !== "mouse") return;
  cursor.style.transform = `translate3d(${event.clientX + 8}px, ${event.clientY + 8}px, 0)`;
  cursor.classList.add("active");
}, { passive: true });
document.addEventListener("pointerleave", () => cursor.classList.remove("active"));
document.querySelectorAll(".magnetic").forEach((button) => {
  button.addEventListener("pointermove", (event) => {
    if (!motionAllowed() || !finePointer.matches || event.pointerType !== "mouse") return;
    const rect = button.getBoundingClientRect();
    button.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * .09}px, ${(event.clientY - rect.top - rect.height / 2) * .17}px)`;
  });
  button.addEventListener("pointerleave", () => { button.style.transform = ""; });
});

function applyMotionSetting() {
  motionButton.hidden = reducedMotion.matches;
  if (!motionAllowed()) {
    boot.hidden = true;
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    targetX = targetY = x = y = 0;
    character.style.translate = "";
    sun.style.translate = "";
    document.querySelectorAll(".magnetic").forEach((button) => { button.style.transform = ""; });
  } else {
    queueFrame();
  }
}
motionButton.addEventListener("click", () => {
  const paused = root.classList.toggle("motion-paused");
  motionButton.textContent = paused ? "Animasiyanı başlat" : "Animasiyanı dayandır";
  motionButton.setAttribute("aria-label", motionButton.textContent);
  applyMotionSetting();
});
reducedMotion.addEventListener("change", applyMotionSetting);
applyMotionSetting();

/* Məhsul qalereyası */
const gallery = $(".gallery");
const galleryControls = $(".gallery-controls");
const panels = [...photos.children];
const galleryButtons = [...galleryControls.querySelectorAll("button")];
const delay = Number(theme.getPropertyValue("--autoplay-ms"));
const touchDelay = Number(theme.getPropertyValue("--gallery-touch-ms"));
const fadeDuration = Number.parseFloat(theme.getPropertyValue("--gallery-fade"));
let activeSlide = 0;
let desiredSlide = 0;
let inView = false;
let hovered = false;
let touching = false;
let switching = false;
let loadingSlide = false;
let automaticRequest = false;
let remaining = delay;
let startedAt = 0;
let timer = 0;
let touchTimer = 0;
let gesture = null;
let transition;
galleryControls.hidden = false;

function canPlay() {
  return motionAllowed() && inView && !document.hidden && !hovered && !touching &&
    !gallery.querySelector(":focus-visible");
}

function stopTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = 0;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
  }
  gallery.removeAttribute("data-playing");
}

// One timer shares its duration with the CSS progress line. Both pause together
// and restart from zero on selection, including the last-to-first wrap.
function syncPlayback() {
  if (!motionAllowed()) {
    transition?.finish();
    stopTimer();
    gallery.removeAttribute("data-progress");
    remaining = delay;
    return;
  }
  if (!canPlay() || loadingSlide) {
    stopTimer();
    return;
  }
  if (timer) return;
  gallery.setAttribute("data-progress", "");
  gallery.setAttribute("data-playing", "");
  startedAt = performance.now();
  timer = setTimeout(() => {
    timer = 0;
    remaining = 0;
    gallery.removeAttribute("data-playing");
    if (canPlay()) void selectSlide(activeSlide + 1, true);
  }, remaining);
}

function resetProgress() {
  stopTimer();
  remaining = delay;
  gallery.removeAttribute("data-progress");
  // Apply removal before restarting the same thumbnail's CSS animation.
  void galleryControls.offsetWidth;
}

async function selectSlide(index, automatic = false) {
  desiredSlide = (index + panels.length) % panels.length;
  automaticRequest = automatic;
  if (!automatic) resetProgress();
  if (switching) return;
  switching = true;
  stopTimer();
  try {
    while (desiredSlide !== activeSlide) {
      const next = desiredSlide;
      const incoming = panels[next];
      const image = incoming.querySelector("img");
      loadingSlide = true;
      stopTimer();
      image.loading = "eager";
      if (!image.hasAttribute("src")) image.src = image.hasAttribute("data-character") ? character.src : image.dataset.src;
      await image.decode();
      if (next !== desiredSlide) continue;
      if (automaticRequest && !canPlay()) {
        desiredSlide = activeSlide;
        break;
      }

      const outgoing = panels[activeSlide];
      activeSlide = next;
      loadingSlide = false;
      resetProgress();
      incoming.hidden = false;
      outgoing.setAttribute("aria-hidden", "true");
      incoming.removeAttribute("aria-hidden");
      for (const button of galleryButtons) button.removeAttribute("aria-current");
      galleryButtons[activeSlide].setAttribute("aria-current", "true");
      try {
        if (motionAllowed()) {
          incoming.classList.add("entering");
          transition = incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeDuration });
          syncPlayback();
          await transition.finished;
        }
      } finally {
        transition = undefined;
        outgoing.hidden = true;
        incoming.classList.remove("entering");
      }
    }
  } catch {
    desiredSlide = activeSlide;
    resetProgress();
  } finally {
    switching = false;
    loadingSlide = false;
    syncPlayback();
  }
}

galleryButtons.forEach((button, index) => {
  button.addEventListener("click", () => selectSlide(index));
});
galleryControls.addEventListener("keydown", (event) => {
  const index = galleryButtons.indexOf(event.target);
  const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: panels.length - 1 }[event.key];
  if (index < 0 || next === undefined) return;
  event.preventDefault();
  galleryButtons[(next + panels.length) % panels.length].focus();
  selectSlide(next);
});
gallery.addEventListener("pointermove", (event) => {
  // A stationary pointer already over the gallery as it scrolls into view
  // should not count as a hover until the visitor moves the mouse.
  if (event.pointerType !== "mouse" || hovered) return;
  hovered = true;
  syncPlayback();
});
function clearHover() {
  hovered = false;
  syncPlayback();
}
gallery.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") clearHover();
});
gallery.addEventListener("focusin", syncPlayback);
gallery.addEventListener("focusout", () => queueMicrotask(syncPlayback));
gallery.addEventListener("touchstart", (event) => {
  clearTimeout(touchTimer);
  touching = true;
  const touch = event.touches[0];
  gesture = event.touches.length === 1 && photos.contains(event.target) ? { x: touch.clientX, y: touch.clientY } : null;
  syncPlayback();
}, { passive: true });
function endTouch(event) {
  if (event.touches.length) return;
  if (gesture && event.type === "touchend") {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) selectSlide(desiredSlide + (dx < 0 ? 1 : -1));
  }
  gesture = null;
  touchTimer = setTimeout(() => {
    touching = false;
    syncPlayback();
  }, touchDelay);
}
gallery.addEventListener("touchend", endTouch, { passive: true });
gallery.addEventListener("touchcancel", endTouch, { passive: true });
new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting && entry.intersectionRatio >= .25;
  if (!inView) clearHover();
  else syncPlayback();
}, { threshold: .25 }).observe(gallery);
addEventListener("blur", clearHover);
document.addEventListener("visibilitychange", clearHover);
reducedMotion.addEventListener("change", syncPlayback);
motionButton.addEventListener("click", syncPlayback);

/* Buraxılış tarixi */
const display = $("#countdown");
const dropTime = Date.parse(RELEASE_DATE);
if (Number.isFinite(dropTime)) {
  function updateCountdown() {
    const seconds = Math.max(0, Math.floor((dropTime - Date.now()) / 1000));
    if (!seconds) {
      display.textContent = "Buraxılış vaxtı çatdı";
      return false;
    }
    const two = (value) => String(value).padStart(2, "0");
    display.textContent = `${Math.floor(seconds / 86400)} gün ${two(Math.floor(seconds / 3600) % 24)}:${two(Math.floor(seconds / 60) % 60)}:${two(seconds % 60)}`;
    return true;
  }
  if (updateCountdown()) {
    const timer = setInterval(() => { if (!updateCountdown()) clearInterval(timer); }, 1000);
  }
}

/* Göndəriş, mobil düymə və təsdiq */
const form = $("#signup");
const status = $("#form-status");
const submit = $(".submit");
const submitLabel = $(".submit-label");
const sizeGroup = $("#sizes");
const sizeError = $("#size-error");
const contactError = $("#contact-error");
const customerErrors = {
  first_name: $("#first-name-error"),
  last_name: $("#last-name-error"),
  instagram: $("#instagram-error"),
};
const contactSwitch = $(".contact-switch");
const channel = form.elements.contact_channel;
const contactFields = [...form.querySelectorAll("[data-field]")];
const contactButtons = [...contactSwitch.querySelectorAll("button")];
const mobile = $(".mobile-cta");
const success = $(".success");
const heading = $("#waitlist-title");
const firstSize = form.querySelector('[name="size"]');
let saved = false;
const sizeGuide = $("#size-guide");
const openSizeGuide = $("#open-size-guide");
if (typeof sizeGuide.showModal === "function") {
  openSizeGuide.hidden = false;
  openSizeGuide.addEventListener("click", () => sizeGuide.showModal());
}
contactSwitch.hidden = false;
function selectContact(button) {
  channel.value = button.dataset.contact;
  for (const option of contactButtons) {
    option.setAttribute("aria-selected", String(option === button));
    option.tabIndex = option === button ? 0 : -1;
  }
  for (const field of contactFields) {
    field.hidden = field.dataset.field !== channel.value;
    const input = field.querySelector("input");
    input.disabled = field.hidden;
    input.removeAttribute("aria-invalid");
  }
  contactError.textContent = "";
  status.textContent = "";
}
contactButtons.forEach((button) => button.addEventListener("click", () => selectContact(button)));
contactSwitch.addEventListener("keydown", (event) => {
  const index = contactButtons.indexOf(event.target);
  const next = { ArrowLeft: 1 - index, ArrowRight: 1 - index, Home: 0, End: 1 }[event.key];
  if (index < 0 || next === undefined) return;
  event.preventDefault();
  selectContact(contactButtons[next]);
  contactButtons[next].focus();
});

new IntersectionObserver(([entry]) => { mobile.hidden = entry.isIntersecting || saved; })
  .observe($("#waitlist"));

function showError(message, target, output = status) {
  output.textContent = message;
  if (!target) return;
  const field = output === sizeError ? sizeGroup : target.closest(".field");
  target.setAttribute("aria-invalid", "true");
  target.setAttribute("aria-describedby", output.id);
  field.classList.remove("shake");
  if (motionAllowed()) requestAnimationFrame(() => field.classList.add("shake"));
  target.focus();
}
form.addEventListener("input", ({ target }) => {
  if (target.name === "size") {
    firstSize.removeAttribute("aria-invalid");
    sizeError.textContent = "";
  } else if (target.name === "contact") {
    target.removeAttribute("aria-invalid");
    contactError.textContent = "";
  } else if (Object.hasOwn(customerErrors, target.name)) {
    target.removeAttribute("aria-invalid");
    customerErrors[target.name].textContent = "";
  }
  status.textContent = "";
});
form.noValidate = true;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const contact = form.querySelector('input[name="contact"]:enabled');
  const value = contact.value.trim();
  const email = channel.value === "email";
  const contactMessage = email
    ? "Düzgün e-poçt ünvanı yaz. Məsələn, ad@example.com."
    : "WhatsApp nömrəsini +994 və 9 rəqəmlə yaz.";
  if (!form.elements.first_name.value.trim()) {
    return showError("Adını yaz.", form.elements.first_name, customerErrors.first_name);
  }
  if (!form.elements.size.value) return showError("S, M, L və ya XL ölçülərindən birini seç.", firstSize, sizeError);
  if (!value || (email ? !contact.validity.valid || !/@[^@]+\.[^@]+$/.test(value) :
    !/^\+[0-9 ()-]+$/.test(value) || !/^\+994[0-9]{9}$/.test(value.replace(/[ ()-]/g, "")))) {
    return showError(contactMessage, contact, contactError);
  }
  if (location.protocol === "file:") return showError("Qeydiyyat üçün bu səhifəni saytın ünvanından aç.");

  const body = new URLSearchParams(new FormData(form));
  const fieldControls = [...form.querySelectorAll('input:not([type="hidden"]):enabled, .contact-switch button')];
  for (const control of fieldControls) control.disabled = true;
  submit.disabled = true;
  submitLabel.textContent = "Göndərilir…";
  form.setAttribute("aria-busy", "true");
  status.textContent = "";
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST", headers: { Accept: "application/json" },
      body, signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) {
      for (const control of fieldControls) control.disabled = false;
      if (Object.hasOwn(customerErrors, data.field)) {
        return showError(data.message, form.elements[data.field], customerErrors[data.field]);
      }
      const target = data.field === "contact" ? contact : data.field === "size" ? firstSize : null;
      const output = target === contact ? contactError : target === firstSize ? sizeError : status;
      return showError(data.message || "Bir az sonra yenidən cəhd et.", target, output);
    }
    saved = true;
    form.hidden = true;
    heading.hidden = true;
    $("#waitlist").setAttribute("aria-labelledby", "success-title");
    mobile.hidden = true;
    $("#success-message").textContent = data.message;
    success.hidden = false;
    const title = success.querySelector("h2");
    title.focus();
    if (motionAllowed()) burst();
  } catch {
    showError("Bağlantını yoxla və yenidən cəhd et.");
  } finally {
    for (const control of fieldControls) control.disabled = false;
    submit.disabled = false;
    submitLabel.textContent = "Siyahıya qoşul";
    form.removeAttribute("aria-busy");
  }
});

function burst() {
  const fx = $("#burst");
  const pen = fx.getContext("2d");
  if (!pen) return;
  fx.width = fx.clientWidth;
  fx.height = fx.clientHeight;
  const embers = Array.from({ length: 48 }, (_, index) => {
    const angle = index / 48 * Math.PI * 2;
    const speed = 55 + Math.random() * 155;
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 28, size: 1 + Math.random() * 3 };
  });
  const start = performance.now();
  function paint(now) {
    const t = (now - start) / 1000;
    pen.clearRect(0, 0, fx.width, fx.height);
    if (t > 1 || !motionAllowed()) return;
    pen.globalAlpha = (1 - t) ** 1.5;
    pen.fillStyle = accent;
    embers.forEach((spark) => {
      pen.fillRect(fx.width / 2 + spark.vx * t, fx.height / 2 + spark.vy * t + 60 * t * t, spark.size, spark.size * 1.7);
    });
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}
