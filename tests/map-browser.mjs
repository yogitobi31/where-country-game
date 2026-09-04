// Usage: BASE_URL=http://localhost:3000 node tests/map-browser.mjs
// Uses an installed Playwright, or PLAYWRIGHT_MODULE_URL pointing to a provided runtime.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL || 'playwright'
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});
const url = process.env.BASE_URL || 'http://localhost:3000';
const failures = [];
const desktop = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
for (const page of [desktop, mobile])
  page.on('pageerror', (error) => failures.push(error.message));

async function start(page, continent = '유럽', all = false) {
  await page.goto(url);
  if (all) await page.getByRole('tab', { name: /초고수/ }).click();
  await page.getByRole('button', { name: /대륙별 학습/ }).click();
  await page.getByRole('button', { name: new RegExp(continent) }).click();
  await page.getByRole('button', { name: /탐험 시작하기/ }).click();
  await page.locator('.world-map').waitFor();
}
async function view(page) {
  return (await page.locator('.world-map').getAttribute('viewBox'))
    .split(' ')
    .map(Number);
}
async function center(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function tapMarker(page, code) {
  for (let i = 0; i < 5; i++) {
    const selector = await page
      .locator('[data-marker-codes]')
      .evaluateAll(
        (es, c) =>
          es
            .find((e) =>
              e.getAttribute('data-marker-codes').split(',').includes(c),
            )
            ?.getAttribute('data-marker-codes'),
        code,
      );
    if (!selector) return false;
    const element = page.locator(`[data-marker-codes="${selector}"]`);
    const point = await center(element);
    await page.touchscreen.tap(point.x, point.y);
    if (selector === code) return true;
  }
  return false;
}
async function clickCountry(page, code) {
  const point = await page
    .locator(`[data-country-code="${code}"]`)
    .evaluate((element) => {
      const r = element.getBoundingClientRect(),
        v = element.closest('.map-scroll').getBoundingClientRect();
      for (
        let y = Math.max(r.top, v.top) + 3;
        y < Math.min(r.bottom, v.bottom);
        y += 4
      )
        for (
          let x = Math.max(r.left, v.left) + 3;
          x < Math.min(r.right, v.right);
          x += 4
        )
          if (document.elementFromPoint(x, y) === element) return { x, y };
      return null;
    });
  assert.ok(point, `visible click point for ${code}`);
  await page.mouse.click(point.x, point.y);
}

try {
  await start(desktop);
  const rect = await desktop.locator('.map-scroll').boundingBox();
  const pointer = await center(desktop.locator('[data-country-code="GR"]'));
  const before = await view(desktop);
  const normalized = [
    (pointer.x - rect.x) / rect.width,
    (pointer.y - rect.y) / rect.height,
  ];
  const worldPoint = [
    before[0] + normalized[0] * before[2],
    before[1] + normalized[1] * before[3],
  ];
  await desktop.mouse.move(pointer.x, pointer.y);
  await desktop.mouse.wheel(0, -462);
  await desktop.waitForTimeout(250);
  const after = await view(desktop);
  const drift = Math.hypot(
    ((worldPoint[0] - after[0]) / after[2]) * rect.width + rect.x - pointer.x,
    ((worldPoint[1] - after[1]) / after[3]) * rect.height + rect.y - pointer.y,
  );
  assert.ok(drift < 1, `cursor zoom drift ${drift}px`);
  const feedback = await desktop.locator('.feedback-card').innerText();
  await desktop.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await desktop.mouse.down();
  await desktop.mouse.move(
    rect.x + rect.width / 2 - 60,
    rect.y + rect.height / 2 + 20,
    { steps: 12 },
  );
  await desktop.mouse.up();
  assert.equal(
    await desktop.locator('.feedback-card').innerText(),
    feedback,
    'drag cannot submit an answer',
  );
  assert.ok((await view(desktop))[0] > after[0]);
  await desktop.getByRole('button', { name: '대륙 전체에 맞추기' }).click();
  assert.deepEqual(
    await view(desktop),
    before,
    'fit resets the complete camera',
  );
  await desktop.getByRole('button', { name: '지도 확대', exact: true }).click();
  const userZoom = await desktop.locator('.map-toolbar span').innerText();
  await desktop.getByRole('button', { name: /정답 위치 확대/ }).click();
  const code = (await desktop.locator('.flag-postcard img').getAttribute('src'))
    .match(/([a-z]{2})\.svg/)[1]
    .toUpperCase();
  await clickCountry(desktop, code);
  assert.match(
    await desktop.locator('.feedback-card').innerText(),
    /정답이에요/,
  );
  assert.match(await desktop.locator('.site-header').innerText(), /85/);
  await desktop.getByRole('button', { name: /다음 나라 찾기/ }).click();
  assert.equal(
    await desktop.locator('.map-toolbar span').innerText(),
    userZoom,
    'next question restores the user view after a hint',
  );
  assert.ok(
    await desktop
      .locator('.flag-postcard img')
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  );
  console.log(
    'PASS desktop: cursor anchor, drag suppression, fit, hint scoring, next-question zoom, SVG flag',
  );

  await start(mobile);
  const sm = await center(mobile.locator('[data-country-code="SM"]'));
  await mobile.touchscreen.tap(sm.x, sm.y);
  assert.match(
    await mobile.locator('.feedback-card').innerText(),
    /첫 번째 클릭/,
    'crowded microstates must magnify without answering',
  );
  assert.ok(await tapMarker(mobile, 'SM'));
  assert.match(await mobile.locator('.feedback-card').innerText(), /산마리노/);
  assert.doesNotMatch(
    await mobile.locator('.feedback-card').innerText(),
    /바티칸/,
  );
  await mobile.getByRole('button', { name: '대륙 전체에 맞추기' }).click();
  const touch = await mobile.context().newCDPSession(mobile);
  const midpoint = await center(mobile.locator('.map-scroll'));
  const pinchBefore = await view(mobile),
    priorFeedback = await mobile.locator('.feedback-card').innerText();
  const points = (radius) => [
    { x: midpoint.x - radius, y: midpoint.y, id: 1 },
    { x: midpoint.x + radius, y: midpoint.y, id: 2 },
  ];
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: points(35),
  });
  for (let radius = 39; radius <= 67; radius += 4)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(radius),
    });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  const pinchAfter = await view(mobile);
  assert.ok(pinchAfter[2] < pinchBefore[2] * 0.6);
  assert.ok(
    Math.abs(
      pinchBefore[0] + pinchBefore[2] / 2 - pinchAfter[0] - pinchAfter[2] / 2,
    ) < 0.1,
  );
  assert.equal(
    await mobile.locator('.feedback-card').innerText(),
    priorFeedback,
  );
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.waitForTimeout(100);
  const landscape = await mobile.locator('.map-scroll').boundingBox();
  assert.ok(landscape.height >= 200 && landscape.y + landscape.height <= 390);
  await mobile.setViewportSize({ width: 390, height: 667 });
  await mobile.waitForTimeout(100);
  assert.ok((await mobile.locator('.map-scroll').boundingBox()).height >= 250);
  console.log(
    'PASS mobile: San Marino is not Vatican, pinch anchor, no gesture answers, portrait and landscape map space',
  );

  for (const [name, count] of [
    ['아시아', 49],
    ['유럽', 45],
    ['아프리카', 54],
    ['북미', 23],
    ['남미', 12],
    ['오세아니아', 14],
  ]) {
    await start(desktop, name, true);
    assert.equal(
      await desktop.locator('[data-country-code]').count(),
      count,
      name,
    );
    assert.ok((await view(desktop)).every(Number.isFinite));
  }
  const oc = await view(desktop);
  assert.ok(oc[2] < 400, 'Oceania does not span the entire world');
  assert.ok(
    (await desktop.locator('[data-country-code="AU"]').boundingBox()).width >
      300,
  );
  for (const code of ['NR', 'WS', 'FJ'])
    assert.ok(
      await desktop.locator(`[data-marker-codes="${code}"]`).count(),
      `visible ${code} pin`,
    );
  assert.deepEqual(failures, []);
  console.log(
    'PASS all six continent filters, Pacific framing, Nauru/Samoa/Fiji pins, no browser errors',
  );
} finally {
  await browser.close();
}
