import { expect, test, type Page } from '@playwright/test';

// Month-grid e2e: drives the real web app (Metro on the host) against the
// throwaway Radicale seeded by seed.mjs. Dates mirror seed.mjs: fixtures live
// in the current month and current month + 3. Navigation uses the header
// chevrons/Today button — deterministic, unlike scroll gestures.

const pad = (n: number) => `${n}`.padStart(2, '0');
const dateString = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthTitle = (d: Date) =>
  d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

const now = new Date();
const target = (day: number) =>
  new Date(now.getFullYear(), now.getMonth() + 3, day);
/** Local-midnight Monday of the week containing d (grid weeks start Monday). */
const mondayOf = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
}

async function cancelEditor(page: Page) {
  await page.getByText('Cancel', { exact: true }).click();
  await expect(page.getByText('New event')).toHaveCount(0);
  await expect(page.getByText('Edit event')).toHaveCount(0);
}

// Editor fields by tab order: 0 = Title, 1 = Date (only the editor's inputs
// exist while the modal is open).
const editorInput = (page: Page, n: number) => page.getByRole('textbox').nth(n);

test('month grid: chips, banners, navigation, editors', async ({ page }) => {
  await test.step('initial load: current month, today chip visible', async () => {
    await page.goto('/');
    await expect(page.getByTestId('calendar-header-label')).toHaveText(
      monthTitle(now),
      { timeout: 30_000 }
    );
    await expect(page.getByText('🧪 E2E Today')).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, '01-initial-today');
  });

  await test.step('chevron ×3 → target month, first week snapped to top', async () => {
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('calendar-next').click();
    }
    await expect(page.getByTestId('calendar-header-label')).toHaveText(
      monthTitle(target(1))
    );
    await expect(page.getByText('🧪 E2E Morning')).toBeVisible({
      timeout: 30_000,
    });

    // The week containing the 1st settles at the grid's top edge.
    const gridBox = await page.getByTestId('month-grid').boundingBox();
    const firstWeekCell = page.getByTestId(
      `day-cell-${dateString(mondayOf(target(1)))}`
    );
    await expect
      .poll(async () => {
        const box = await firstWeekCell.boundingBox();
        return box ? Math.abs(box.y - gridBox!.y) : Number.NaN;
      })
      .toBeLessThan(4);
    await shot(page, '02-target-month');
  });

  await test.step('banners: span days 8–10, stack above chips, break per week', async () => {
    // Some segment of the multi-day banner horizontally overlaps each covered
    // day cell (the span may break across a week edge on some run dates).
    const segments = page.getByText('🧪 E2E Multi-day');
    const segmentBoxes = [];
    for (let i = 0; i < (await segments.count()); i++) {
      segmentBoxes.push(await segments.nth(i).boundingBox());
    }
    for (const day of [8, 9, 10]) {
      const cell = await page
        .getByTestId(`day-cell-${dateString(target(day))}`)
        .boundingBox();
      expect(
        segmentBoxes.some(
          (b) => b && cell && b.x < cell.x + cell.width && b.x + b.width > cell.x
        )
      ).toBe(true);
    }

    // All-day banner renders above the timed chip on day 6.
    const allDayBox = await page.getByText('🧪 E2E All-day').boundingBox();
    const morningBox = await page.getByText('🧪 E2E Morning').boundingBox();
    expect(allDayBox!.y).toBeLessThan(morningBox!.y);

    // A 9-day banner always crosses a week boundary → ≥2 segments.
    expect(await page.getByText('🧪 E2E Longspan').count()).toBeGreaterThanOrEqual(
      2
    );
    await shot(page, '03-banners');
  });

  await test.step('"+N more" → day popover → edit editor', async () => {
    const more = page.getByTestId(`more-${dateString(target(27))}`);
    await expect(more).toHaveText(/\+\d+ more/);
    await more.click();
    const popover = page.getByTestId('day-popover');
    await expect(popover).toBeVisible();
    await expect(popover.getByText(/🧪 Busy/)).toHaveCount(10);
    await popover.getByText('🧪 Busy 5').click();
    await expect(page.getByText('Edit event')).toBeVisible();
    await expect(editorInput(page, 0)).toHaveValue('🧪 Busy 5');
    await shot(page, '04-popover-edit');
    await cancelEditor(page);
  });

  await test.step('empty day tap → create editor dated that day', async () => {
    await page.getByTestId(`day-cell-${dateString(target(15))}`).click();
    await expect(page.getByText('New event')).toBeVisible();
    await expect(editorInput(page, 1)).toHaveValue(dateString(target(15)));
    await shot(page, '05-day-tap-create');
    await cancelEditor(page);
  });

  await test.step('chip tap → edit editor', async () => {
    await page.getByText('🧪 E2E Morning').click();
    await expect(page.getByText('Edit event')).toBeVisible();
    await expect(editorInput(page, 0)).toHaveValue('🧪 E2E Morning');
    await shot(page, '06-chip-tap-edit');
    await cancelEditor(page);
  });

  await test.step('next month is empty', async () => {
    await page.getByTestId('calendar-next').click();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 4, 1);
    await expect(page.getByTestId('calendar-header-label')).toHaveText(
      monthTitle(nextMonth)
    );
    // Seeded "E2E" events end by target(25) and can't reach this month's first
    // grid week; the day-27 "Busy" fixtures are deliberately excluded from
    // this match since that week can start as early as the 26th. Events stay
    // loaded across months now, so mounted off-viewport rows of the previous
    // month legitimately keep their chips in the DOM — "empty" means no
    // fixture intersects the grid viewport.
    const gridBox = await page.getByTestId('month-grid').boundingBox();
    const fixtures = page.getByText(/🧪 E2E/);
    await expect
      .poll(
        async () => {
          const count = await fixtures.count();
          let inView = 0;
          for (let i = 0; i < count; i++) {
            const box = await fixtures.nth(i).boundingBox();
            if (
              box &&
              gridBox &&
              box.y < gridBox.y + gridBox.height &&
              box.y + box.height > gridBox.y
            ) {
              inView++;
            }
          }
          return inView;
        },
        { timeout: 30_000 }
      )
      .toBe(0);
    await shot(page, '07-empty-month');
  });

  await test.step('Today returns to the current month', async () => {
    await page.getByTestId('calendar-today').click();
    await expect(page.getByTestId('calendar-header-label')).toHaveText(
      monthTitle(now)
    );
    await expect(page.getByText('🧪 E2E Today')).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, '08-today');
  });

  await test.step('deep links: ?day= and ?new=', async () => {
    await page.goto(`/?day=${dateString(target(20))}`);
    await expect(page.getByTestId('calendar-header-label')).toHaveText(
      monthTitle(target(1)),
      { timeout: 30_000 }
    );
    await expect(page.getByText('🧪 E2E Scroll target')).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, '09-deeplink-day');

    await page.goto('/?new=e2e-nonce');
    await expect(page.getByText('New event')).toBeVisible({ timeout: 30_000 });
    await expect(editorInput(page, 1)).toHaveValue(dateString(now));
    await shot(page, '10-deeplink-new');
  });
});
