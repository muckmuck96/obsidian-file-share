import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Obsidian Secured File Sharing",
  description: "An obsidian plugin to share files end-to-end encrypted between several vaults.",
  lang: "en-US",
  base: '/obsidian-file-share/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Enhanced settings', link: '/enhanced-settings' }
    ],
    sidebar: [
      {
        text: 'Getting started',
        link: '/getting-started',
        items: [
          { text: 'Receive a file', link: '/receive-file' },
          { text: 'Settings', link: '/settings' }
        ]
      },
      {
        text: 'Enhanced settings',
        link: '/enhanced-settings',
        items: [
          { text: 'Configure server', link: '/enhanced-server-configuration' },
          { text: 'Workflow diagram', link: '/enhanced-workflow-diagram' }
        ]
      },
      {
        text: '',
        items: [
          { text: 'Help', link: '/help' },
          { text: 'Roadmap', link: '/roadmap' },
          { text: 'Changelog', link: '/changelog' },
          { text: 'Support', link: '/support' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/muckmuck96/obsidian-file-share' }
    ],

    editLink: {
			pattern: "https://github.com/muckmuck96/obsidian-file-share/edit/master/docs/:path",
		},
  },
})
