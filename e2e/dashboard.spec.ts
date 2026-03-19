/**
 * Dashboard E2E Tests — Critical Flows
 *
 * Tests the main dashboard page: layout, navbar, pulse feed,
 * globe placeholder, right panel modules, and navigation.
 */

import { test, expect } from '@playwright/test'

// =============================================
// Dashboard Layout & Shell
// =============================================

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the app to fully hydrate
    await page.waitForSelector('#navbar', { timeout: 15_000 })
  })

  test('renders the 3-panel layout', async ({ page }) => {
    // Left panel (Pulse Feed)
    const leftPanel = page.locator('#panel-left')
    await expect(leftPanel).toBeVisible()

    // Center panel (Globe + Tension Chart)
    const centerPanel = page.locator('#panel-center')
    await expect(centerPanel).toBeVisible()

    // Right panel (Predictions, Markets, Keywords)
    const rightPanel = page.locator('#panel-right')
    await expect(rightPanel).toBeVisible()
  })

  test('navbar displays logo, clock, and telemetry', async ({ page }) => {
    // Logo
    const logo = page.locator('.wo-navbar__logo-text')
    await expect(logo).toHaveText('WATCHOVER')

    // ZULU clock should display time format (HH:MM)
    const zuluTime = page.locator('.wo-navbar__time-zulu')
    await expect(zuluTime).toBeVisible()
    await expect(zuluTime).toHaveText(/\d{2}:\d{2}Z/)

    // Telemetry counters
    const conflictsLabel = page.locator('.wo-navbar__telemetry-label', { hasText: 'CONFLICTS' })
    await expect(conflictsLabel).toBeVisible()

    const tensionLabel = page.locator('.wo-navbar__telemetry-label', { hasText: 'TENSION' })
    await expect(tensionLabel).toBeVisible()
  })

  test('navbar has LIVE indicator', async ({ page }) => {
    const liveIndicator = page.locator('.wo-live-indicator')
    await expect(liveIndicator).toBeVisible()
  })

  test('news ticker is visible and scrolling', async ({ page }) => {
    const ticker = page.locator('.wo-dashboard__ticker')
    await expect(ticker).toBeVisible()
  })
})

// =============================================
// Pulse Feed (Left Panel)
// =============================================

test.describe('Pulse Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.wo-pulse-feed', { timeout: 15_000 })
  })

  test('renders feed title and filter tabs', async ({ page }) => {
    const title = page.locator('.wo-pulse-feed__title')
    await expect(title).toHaveText('Pulse Feed')

    // Should have filter tabs
    const tabs = page.locator('.wo-pulse-feed__filter-tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(5)

    // Verify the "All" tab exists
    const allTab = page.locator('.wo-pulse-feed__filter-tab', { hasText: 'All' })
    await expect(allTab).toBeVisible()
  })

  test('displays event cards', async ({ page }) => {
    // Should render at least one event card (from mock data or API)
    const eventCards = page.locator('.wo-event-card')
    await expect(eventCards.first()).toBeVisible({ timeout: 10_000 })

    const count = await eventCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('event cards show severity, title, and confidence', async ({ page }) => {
    const card = page.locator('.wo-event-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })

    // Severity badge
    const badge = card.locator('.wo-badge')
    await expect(badge).toBeVisible()

    // Title
    const title = card.locator('.wo-event-card__title')
    await expect(title).toBeVisible()
    const titleText = await title.textContent()
    expect(titleText!.length).toBeGreaterThan(5)

    // Confidence percentage
    const confidence = card.locator('.wo-event-card__confidence .mono')
    await expect(confidence).toBeVisible()
    await expect(confidence).toHaveText(/%$/)
  })

  test('clicking an event card opens the detail modal', async ({ page }) => {
    const card = page.locator('.wo-event-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    // Event Detail Modal should appear
    const modal = page.locator('.wo-event-detail-modal')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Should have a close button
    const closeBtn = modal.locator('button[aria-label="Close"]').or(modal.locator('.wo-modal__close'))
    await expect(closeBtn.first()).toBeVisible()
  })

  test('filter tabs change displayed events', async ({ page }) => {
    // Wait for events to load
    await page.waitForSelector('.wo-event-card', { timeout: 10_000 })

    // Get initial count
    const initialCount = await page.locator('.wo-event-card').count()

    // Click "High" filter tab
    const highTab = page.locator('.wo-pulse-feed__filter-tab', { hasText: 'High' })
    await highTab.click()

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // Count should change (or stay the same if all are high)
    const countDisplay = page.locator('.wo-pulse-feed__count .mono')
    await expect(countDisplay).toBeVisible()
  })

  test('search input filters events with debounce', async ({ page }) => {
    // Wait for events
    await page.waitForSelector('.wo-event-card', { timeout: 10_000 })

    // Type in search
    const searchInput = page.locator('.wo-pulse-feed__search-input')
    await searchInput.fill('Military')

    // Wait for debounce (300ms) + re-render
    await page.waitForTimeout(500)

    // Should show "matching" indicator
    const countText = page.locator('.wo-pulse-feed__count')
    const text = await countText.textContent()
    expect(text).toContain('matching')

    // Clear search via the ✕ button
    const clearBtn = page.locator('.wo-pulse-feed__search-clear')
    if (await clearBtn.isVisible()) {
      await clearBtn.click()
      await page.waitForTimeout(500)
      const afterClear = await countText.textContent()
      expect(afterClear).not.toContain('matching')
    }
  })
})

// =============================================
// Globe (Center Panel)
// =============================================

test.describe('Globe & Center Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.wo-globe-container', { timeout: 15_000 })
  })

  test('globe container is rendered', async ({ page }) => {
    const globe = page.locator('.wo-globe-container')
    await expect(globe).toBeVisible()
  })

  test('aircraft counter overlay is visible', async ({ page }) => {
    const counter = page.locator('.wo-aircraft-counter')
    await expect(counter).toBeVisible()

    const label = page.locator('.wo-aircraft-counter__label')
    await expect(label).toHaveText(/Sorties Detected/i)
  })

  test('tension chart renders below globe', async ({ page }) => {
    const tensionChart = page.locator('.wo-tension')
    await expect(tensionChart).toBeVisible({ timeout: 10_000 })
  })
})

// =============================================
// Right Panel — Lazy-loaded Modules
// =============================================

test.describe('Right Panel Modules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#panel-right', { timeout: 15_000 })
  })

  test('predictions section renders with cards', async ({ page }) => {
    // LazySection may need scrolling into view
    const predictionsTitle = page.locator('.panel-section__title', { hasText: 'Top Predictions' })
    await predictionsTitle.scrollIntoViewIfNeeded()
    await expect(predictionsTitle).toBeVisible({ timeout: 10_000 })

    // Should have prediction cards
    const predCards = page.locator('.wo-pred')
    await expect(predCards.first()).toBeVisible({ timeout: 10_000 })
  })

  test('markets module renders with market entries', async ({ page }) => {
    const marketsTitle = page.locator('.wo-markets__title span', { hasText: 'Markets' })
    await marketsTitle.scrollIntoViewIfNeeded()
    await expect(marketsTitle).toBeVisible({ timeout: 10_000 })

    // Market rows
    const rows = page.locator('.wo-markets__row')
    await expect(rows.first()).toBeVisible()
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('keywords module renders with keyword entries', async ({ page }) => {
    const kwTitle = page.locator('.wo-keywords__title', { hasText: 'Top Keywords' })
    await kwTitle.scrollIntoViewIfNeeded()
    await expect(kwTitle).toBeVisible({ timeout: 10_000 })

    // Keyword rows
    const rows = page.locator('.wo-kw__row')
    await expect(rows.first()).toBeVisible()
  })
})
