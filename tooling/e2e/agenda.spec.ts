import { expect, test, type Locator, type Page } from '@playwright/test';

// Agenda-view e2e: drives the real web app (Metro on the host) against the
// throwaway Radicale seeded by seed.mjs. Dates mirror seed.mjs: fixtures live
// in the current month and current month + 3.

const CAL = 'month-calendar'; // Calendar testID; cells/arrows derive from it

const pad = (n: number) => `${n}`.padStart(2, '0');
const dateString = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthTitle = (d: Date) =>
  d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
// Chromium and node disagree on the comma ("Tue, 7 Jul" vs "Tue 7 Jul") —
// match the section header with an ICU-tolerant regex instead of a string.
const dayHeader = (d: Date, suffix = '') => {
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return new RegExp(`^${weekday},? ${d.getDate()} ${month}${suffix}$`);
};

const now = new Date();
const target = (day: number) =>
  new Date(now.getFullYear(), now.getMonth() + 3, day);

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
}

/** y of the agenda list's top edge — scroll-landing assertions anchor to it. */
async function listTop(page: Page): Promise<number> {
  const box = await page.getByTestId('agenda-list').boundingBox();
  if (!box) throw new Error('agenda-list not found');
  return box.y;
}

async function agendaScroll(page: Page) {
  return page.getByTestId('agenda-list').evaluate((el) => {
    // testID may land on a wrapper — find the actual scroll container.
    const nodes = [el, ...el.querySelectorAll('*')] as HTMLElement[];
    const scroller = nodes.find((n) => n.scrollHeight > n.clientHeight + 1);
    return scroller
      ? {
          top: scroller.scrollTop,
          max: scroller.scrollHeight - scroller.clientHeight,
        }
      : { top: 0, max: 0 };
  });
}

async function expectAtListTop(page: Page, header: Locator) {
  await expect(header).toBeInViewport();
  // The target section should settle at the top of the agenda — unless it's
  // near the end of the content, where the scroll clamps at max; then "as far
  // down as possible" is the correct landing.
  await expect
    .poll(
      async () => {
        const box = await header.boundingBox();
        if (!box) return Number.NaN;
        const offset = box.y - (await listTop(page));
        const { top, max } = await agendaScroll(page);
        return offset < 120 || top >= max - 4 ? 0 : offset;
      },
      { message: 'section header should settle at the top of the agenda' }
    )
    .toBe(0);
}

async function scrollAgendaToTop(page: Page) {
  await page.getByTestId('agenda-list').evaluate((el) => {
    // testID may land on a wrapper — find the actual scroll container.
    const nodes = [el, ...el.querySelectorAll('*')] as HTMLElement[];
    const scroller = nodes.find((n) => n.scrollHeight > n.clientHeight + 1);
    if (scroller) scroller.scrollTop = 0;
  });
}

test('agenda: grouping, tap-to-scroll, month navigation', async ({ page }) => {
  await test.step('initial load auto-scrolls to today', async () => {
    await page.goto('/');
    await expect(page.getByTestId('agenda-month-label')).toHaveText(
      monthTitle(now),
      { timeout: 30_000 }
    );
    // Fetch settled + auto-scroll landed: today's section (below the filler
    // fold) must be inside the list viewport without any manual scrolling.
    await expect(page.getByText('🧪 E2E Today')).toBeInViewport({
      timeout: 30_000,
    });
    await expect(page.getByText(dayHeader(now, ' · Today'))).toBeInViewport();
    await shot(page, '01-initial-today');
  });

  await test.step('navigate to target month: sections + sort', async () => {
    for (let i = 0; i < 3; i++) {
      await page.getByTestId(`${CAL}.header.rightArrow`).click();
    }
    await expect(page.getByTestId('agenda-month-label')).toHaveText(
      monthTitle(target(1))
    );
    await expect(page.getByText('🧪 E2E Morning')).toBeVisible({
      timeout: 30_000,
    });

    // Exactly the seeded days appear as sections (6, 8, 9, 10, 20)…
    for (const day of [6, 8, 9, 10, 20]) {
      await expect(page.getByText(dayHeader(target(day)))).toBeAttached();
    }
    // …and a day without events has no section.
    await expect(page.getByText(dayHeader(target(15)))).toHaveCount(0);

    // Multi-day event shows under each day it touches (8, 9, 10).
    await expect(page.getByText('🧪 E2E Multi-day')).toHaveCount(3);

    // All-day sorts above the timed event on day 6.
    const allDayBox = await page.getByText('🧪 E2E All-day').boundingBox();
    const morningBox = await page.getByText('🧪 E2E Morning').boundingBox();
    expect(allDayBox!.y).toBeLessThan(morningBox!.y);
    await shot(page, '02-target-month');
  });

  await test.step('tap a day with events → agenda scrolls to it', async () => {
    await page.getByTestId(`${CAL}.day_${dateString(target(20))}`).click();
    await expectAtListTop(page, page.getByText(dayHeader(target(20))));
    await shot(page, '03-tap-day-with-events');
  });

  await test.step('tap an empty day → nearest later section', async () => {
    await scrollAgendaToTop(page);
    await page.getByTestId(`${CAL}.day_${dateString(target(15))}`).click();
    await expectAtListTop(page, page.getByText(dayHeader(target(20))));
    await shot(page, '04-tap-empty-day');
  });

  await test.step('tap past the last event → end of list', async () => {
    await scrollAgendaToTop(page);
    await page.getByTestId(`${CAL}.day_${dateString(target(25))}`).click();
    await expect(page.getByText('🧪 E2E Scroll target')).toBeInViewport();
    await shot(page, '05-tap-after-last');
  });

  await test.step('empty month state', async () => {
    await page.getByTestId(`${CAL}.header.rightArrow`).click();
    await expect(
      page.getByText('No events this month', { exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await shot(page, '06-empty-month');
  });

  await test.step('back to current month → auto-scroll to today again', async () => {
    for (let i = 0; i < 4; i++) {
      await page.getByTestId(`${CAL}.header.leftArrow`).click();
    }
    await expect(page.getByTestId('agenda-month-label')).toHaveText(
      monthTitle(now)
    );
    await expect(page.getByText('🧪 E2E Today')).toBeInViewport({
      timeout: 30_000,
    });
    await shot(page, '07-return-to-today');
  });
});
