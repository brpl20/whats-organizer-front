const port = 9999;
const url = `http://localhost:${port}`;

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
	webServer: {
		command: `npm run build && npm run preview  -- --port ${port}`,
		port
	},
	testDir: 'tests/e2e',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	fullyParallel: true,
	forbidOnly: !process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: url,
		trace: 'on-first-retry',
		headless: false,
		browserName: 'chromium',
		launchOptions: {
			args: ['--allow-file-access-from-files'],
		}
	},
	projects: [
		{
			name: 'chromium',
			url
		}
	]
};

export default config;
