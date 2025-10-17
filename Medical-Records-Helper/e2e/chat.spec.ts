import { test, expect } from "@playwright/test";

test.describe("Health Copilot Chat", () => {
  test("should load the homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Health Copilot")).toBeVisible();
    await expect(page.getByText("Local-first")).toBeVisible();
  });

  test("should display dropzone for PDF upload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Drag & drop a PDF here")).toBeVisible();
  });

  test("should have settings drawer with RAG controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Retrieval")).toBeVisible();
    await expect(page.getByText("RAG top-k")).toBeVisible();
  });

  test("should show composer with send button", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder("Ask about your labs, scans, visit notes");
    await expect(textarea).toBeVisible();

    const sendButton = page.getByRole("button").filter({ hasText: /send/i });
    await expect(sendButton).toBeDisabled();
  });

  test("should enable send button when text is entered", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder("Ask about your labs, scans, visit notes");
    await textarea.fill("What are my lab results?");

    const sendButton = page.locator('button:has-text("")').last();
    await expect(sendButton).toBeEnabled();
  });
});
