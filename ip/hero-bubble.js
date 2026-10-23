(function () {
  'use strict';
  var trigger = document.querySelector('.hero-character-trigger');
  var position = document.querySelector('.hero-speech-position');
  var bubble = position && position.querySelector('.hero-speech');
  if (!trigger || !bubble) return;
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  var hovering = false, keyboardFocus = false, tapped = false, opened = false;
  var openedAt = 0, enterTimer, leaveTimer, animation, revision = 0;

  function clearTimers() {
    clearTimeout(enterTimer);
    clearTimeout(leaveTimer);
  }
  function stopAnimation() {
    if (animation) animation.cancel();
    animation = null;
  }
  function open() {
    clearTimers();
    if (opened) return;
    var wasHidden = position.hidden;
    var computed = getComputedStyle(bubble);
    var opacity = wasHidden ? '0' : computed.opacity;
    var transform = wasHidden ? 'translate(8px,4px) scale(.94)' : computed.transform;
    revision++;
    stopAnimation();
    position.hidden = false;
    opened = true;
    openedAt = performance.now();
    trigger.setAttribute('aria-expanded', 'true');
    if (!reduceMotion.matches) {
      animation = bubble.animate([
        { opacity: opacity, transform: transform },
        { opacity: 1, transform: 'translate(0,0) scale(1)' }
      ], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    }
  }
  function close(immediate) {
    clearTimers();
    if (position.hidden) return;
    var computed = getComputedStyle(bubble);
    var opacity = computed.opacity, transform = computed.transform;
    var token = ++revision;
    stopAnimation();
    opened = false;
    trigger.setAttribute('aria-expanded', 'false');
    if (immediate || reduceMotion.matches) {
      position.hidden = true;
      return;
    }
    animation = bubble.animate([
      { opacity: opacity, transform: transform },
      { opacity: 0, transform: 'translate(0,4px) scale(.985)' }
    ], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'both' });
    animation.finished.then(function () {
      if (token !== revision) return;
      position.hidden = true;
      stopAnimation();
    }).catch(function () { /* Re-entry cancels the exit animation. */ });
  }
  function requestOpen() {
    clearTimers();
    if (!opened) enterTimer = setTimeout(open, 180);
  }
  function requestClose() {
    clearTimers();
    if (hovering || keyboardFocus || tapped) return;
    leaveTimer = setTimeout(function () { close(false); }, Math.max(180, 1100 - (performance.now() - openedAt)));
  }
  trigger.addEventListener('pointerenter', function (event) {
    if (event.pointerType !== 'mouse') return;
    hovering = true;
    requestOpen();
  });
  trigger.addEventListener('pointerleave', function (event) {
    if (event.pointerType !== 'mouse') return;
    hovering = false;
    requestClose();
  });
  trigger.addEventListener('focus', function () {
    if (!trigger.matches(':focus-visible')) return;
    keyboardFocus = true;
    requestOpen();
  });
  trigger.addEventListener('blur', function () {
    keyboardFocus = false;
    requestClose();
  });
  trigger.addEventListener('click', function (event) {
    if (event.pointerType === 'mouse') return;
    if (event.detail === 0) { open(); return; }
    tapped = !tapped;
    if (tapped) open();
    else close(false);
  });
  document.addEventListener('pointerdown', function (event) {
    if (!tapped || trigger.contains(event.target)) return;
    tapped = false;
    requestClose();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    tapped = false;
    close(false);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { tapped = hovering = keyboardFocus = false; close(true); }
  });
})();
