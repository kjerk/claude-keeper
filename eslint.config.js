import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		files: ['viewer/src/**/*.js', 'userscript/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				// Browser
				document: 'readonly',
				window: 'readonly',
				navigator: 'readonly',
				localStorage: 'readonly',
				setTimeout: 'readonly',
				console: 'readonly',
				getComputedStyle: 'readonly',
				FileReader: 'readonly',
				Blob: 'readonly',
				URL: 'readonly',
				XMLHttpRequest: 'readonly',
				fetch: 'readonly',
				history: 'readonly',
				location: 'readonly',
				// CDN libraries
				marked: 'readonly',
				hljs: 'readonly',
				// Tampermonkey
				GM_xmlhttpRequest: 'readonly',
				GM_download: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
		},
	},
];
