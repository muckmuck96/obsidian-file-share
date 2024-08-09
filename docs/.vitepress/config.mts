import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Obsidian Secured File Sharing",
  description: "An obsidian plugin to share files end-to-end encrypted between several vaults.",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Enhanced settings', link: '/enhanced-settings' }
    ],

    sidebar: [
      {
        text: 'Getting started',
        link: '/getting-started',
        items: [
          { text: 'Installation', link: '/installation' },
          { text: 'Configure settings', link: '/settings' },
          { text: 'Start sharing', link: '/start-sharing' },
          { text: 'Receive a file', link: '/receive-file' }
        ]
      },
      {
        text: 'Enhanced settings',
        link: '/enhanced-settings',
        items: [
          { text: 'Configure server', link: '/enhanced-server-configuration' }
        ]
      },
      {
        text: 'Other',
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
    ]
  },

  base: '/obsidian-file-share/',
})
