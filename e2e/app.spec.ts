import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Логин").fill("demo");
  await page.getByLabel("Пароль").fill("demo12345");
  await page.getByRole("button", { name: "Войти в приложение" }).click();
  await expect(page.getByRole("heading", { name: "6 июля" })).toBeVisible();
  await expect(page).toHaveURL(/\/day\/2026-07-06$/);
}

function isoDateWithOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function titleForIsoDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

test.describe("Asysha Pro application shell", () => {
  test("shows login screen and accepts demo credentials", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Прогресс дня")).toBeVisible();
  });

  test("supports the main planning flow", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "6 июля" })).toBeVisible();
    await expect(page.getByText("Прогресс дня")).toBeVisible();

    await page.getByTitle("Предыдущий день").click();
    await expect(page.getByRole("heading", { name: "5 июля" })).toBeVisible();
    await expect(page).toHaveURL(/\/day\/2026-07-05$/);
    await page.getByTitle("Следующий день").click();
    await expect(page.getByRole("heading", { name: "6 июля" })).toBeVisible();
    await expect(page).toHaveURL(/\/day\/2026-07-06$/);

    const todayTitle = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
    }).format(new Date());
    const today = new Date();
    const todayIso = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    await page.getByRole("button", { name: "Сегодня" }).click();
    await expect(page.getByRole("heading", { name: todayTitle })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/day/${todayIso}$`));
    await page.getByTitle("Предыдущий день").click();
    await page.getByTitle("Следующий день").click();

    const taskTitle = `Проверить Playwright ${Date.now()}`;
    const editedTaskTitle = `${taskTitle} edited`;

    await page.getByLabel("Быстрая задача").fill(taskTitle);
    await page.getByTitle("Добавить задачу").click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    await page.locator(".task-body-button").filter({ hasText: taskTitle }).click();
    await expect(page.getByText("Редактировать задачу")).toBeVisible();
    await expect(page).toHaveURL(/\/tasks\/\d+\?date=\d{4}-\d{2}-\d{2}$/);
    await page.getByLabel("Название задачи").fill(editedTaskTitle);
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText(editedTaskTitle)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/day/${todayIso}$`));

    await page.getByRole("button", { name: /Неделя/ }).click();
    await expect(page.getByRole("heading", { name: "Эта неделя" })).toBeVisible();
    await expect(page.getByText(/6 июля - 12 июля/)).toBeVisible();
    await expect(page).toHaveURL(/\/week\/2026-07-06$/);
    await page.getByTitle("Следующая неделя").click();
    await expect(page.getByText(/13 июля - 19 июля/)).toBeVisible();
    await expect(page).toHaveURL(/\/week\/2026-07-13$/);
    await page.goBack();
    await expect(page.getByText(/6 июля - 12 июля/)).toBeVisible();
    await page.goForward();
    await expect(page.getByText(/13 июля - 19 июля/)).toBeVisible();
    await page.getByTitle("Предыдущая неделя").click();
    await expect(page.getByText(/6 июля - 12 июля/)).toBeVisible();

    await page.getByRole("button", { name: /Месяц/ }).click();
    await expect(page.getByRole("heading", { name: /июль/i })).toBeVisible();
    await expect(page).toHaveURL(/\/month\/2026-07$/);
    await page.getByTitle("Следующий месяц").click();
    await expect(page.getByRole("heading", { name: /август/i })).toBeVisible();
    await expect(page).toHaveURL(/\/month\/2026-08$/);
    await page.goBack();
    await expect(page.getByRole("heading", { name: /июль/i })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: /август/i })).toBeVisible();
    await page.getByTitle("Предыдущий месяц").click();
    await expect(page.getByRole("heading", { name: /июль/i })).toBeVisible();

    await page.getByRole("button", { name: /Итоги/ }).click();
    await expect(page.getByRole("heading", { name: "Итоги" })).toBeVisible();
    await expect(page).toHaveURL(/\/stats\?date=/);
  });

  test("supports backlog tasks and removing a date", async ({ page }) => {
    await login(page);

    const taskTitle = `Бэклог Playwright ${Date.now()}`;
    const today = new Date();
    const todayIso = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    await page.getByRole("button", { name: /Бэклог/ }).click();
    await expect(page.getByRole("heading", { name: "Бэклог", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/backlog\?date=2026-07-06$/);

    await page.getByLabel("Быстрая задача в бэклог").fill(taskTitle);
    await page.getByTitle("Добавить в бэклог").click();
    await expect(page.locator(".task-card").filter({ hasText: taskTitle })).toBeVisible();

    await page.locator(".task-body-button").filter({ hasText: taskTitle }).click();
    await expect(page.getByText("Редактировать задачу")).toBeVisible();
    await expect(page.getByText("Без даты")).toBeVisible();
    await expect(page).toHaveURL(/\/tasks\/\d+\?date=2026-07-06$/);

    await page.getByRole("button", { name: "Сегодня" }).click();
    await expect(page.getByLabel("Дата задачи")).toContainText(titleForIsoDate(todayIso));
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page).toHaveURL(new RegExp(`/day/${todayIso}$`));
    await expect(page.locator(".task-card").filter({ hasText: taskTitle })).toBeVisible();

    await page.locator(".task-body-button").filter({ hasText: taskTitle }).click();
    await page.getByRole("button", { name: "Убрать дату" }).click();
    await expect(page.getByText("Без даты")).toBeVisible();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page).toHaveURL(new RegExp(`/backlog\\?date=${todayIso}$`));
    await expect(page.locator(".task-card").filter({ hasText: taskTitle })).toBeVisible();
  });

  test("hides the daily survey on future days", async ({ page }) => {
    await login(page);

    const tomorrowIso = isoDateWithOffset(1);

    await page.goto(`/day/${tomorrowIso}`);
    await expect(page.getByRole("heading", { name: titleForIsoDate(tomorrowIso) })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Вечерний опросник|Опросник заполнен/ }),
    ).toHaveCount(0);

    await page.goto(`/day/${tomorrowIso}/survey`);
    await expect(page).toHaveURL(new RegExp(`/day/${tomorrowIso}$`));
    await expect(page.getByRole("heading", { name: titleForIsoDate(tomorrowIso) })).toBeVisible();
  });

  test("creates multiple reminder jobs for a task", async ({ page }) => {
    await login(page);

    const tomorrowIso = isoDateWithOffset(1);
    const taskTitle = `Напоминания Playwright ${Date.now()}`;

    await page.goto(`/day/${tomorrowIso}`);
    await expect(page.getByRole("heading", { name: titleForIsoDate(tomorrowIso) })).toBeVisible();
    await page.getByTitle("Добавить задачу").click();
    await expect(page.getByText("Новая задача")).toBeVisible();
    await page.getByLabel("Название задачи").fill(taskTitle);
    await page.getByLabel("Начало задачи").click();
    await page.getByLabel("Час 10").click();
    await page.getByLabel("Минута 00").click();
    await page.getByRole("button", { name: "15м" }).click();
    await page.getByLabel("Время напоминания").click();
    await page.getByLabel("Час 09").click();
    await page.getByLabel("Минута 30").click();
    await page.getByLabel("Добавить напоминание по времени").click();
    await expect(page.getByText("За 15м до начала")).toBeVisible();
    await expect(page.getByText("В 09:30")).toBeVisible();

    await page.getByRole("button", { name: "Готово" }).click();
    await expect(page).toHaveURL(new RegExp(`/day/${tomorrowIso}$`));
    await expect(page.locator(".task-card").filter({ hasText: taskTitle })).toBeVisible();
    await expect(page.locator(".task-card").filter({ hasText: taskTitle })).toContainText("2 нап.");

    await page.locator(".task-body-button").filter({ hasText: taskTitle }).click();
    await expect(page.getByText("За 15м до начала")).toBeVisible();
    await expect(page.getByText("В 09:30")).toBeVisible();
  });

  test("opens reflection and telegram screens", async ({ page }) => {
    await login(page);

    await page
      .getByRole("button", { name: /Вечерний опросник|Опросник заполнен/ })
      .click();
    await expect(page.getByText("Оценка продуктивности")).toBeVisible();
    await expect(page).toHaveURL(/\/day\/2026-07-06\/survey$/);
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Опросник заполнен")).toBeVisible();
    await expect(page).toHaveURL(/\/day\/2026-07-06$/);

    await page.getByTitle("Telegram").click();
    await expect(page.getByRole("heading", { name: "Уведомления" })).toBeVisible();
    await expect(page).toHaveURL(/\/telegram\?date=2026-07-06$/);
    await expect(page.getByText("/start a8f3-27c1-9de0")).toBeVisible();
  });

  test("opens settings from the gear button", async ({ page }) => {
    await login(page);

    await page.getByTitle("Настройки").click();
    await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
    await expect(page).toHaveURL(/\/settings\?date=2026-07-06$/);
    await expect(page.getByText("Приложение")).toBeVisible();
    await expect(page.getByText("Состояние")).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("heading", { name: "6 июля" })).toBeVisible();
    await expect(page).toHaveURL(/\/day\/2026-07-06$/);
  });

  test("logs out from settings", async ({ page }) => {
    await login(page);

    await page.getByTitle("Настройки").click();
    await page.getByRole("button", { name: /Выйти/ }).click();
    await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
    await expect(page).toHaveURL(/\/login\?date=2026-07-06$/);
  });
});
