window.CentralData = {

  // =============================================
  // PRODUCTS (Left Sidebar Product Buttons)
  // =============================================
  PRODUCTS: [
    { id: 'worldstreet', name: 'WorldStreet', badge: 'SSO', logo: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=150&q=80', officialUrl: 'https://www.tsionark.com/worldstreet' },
    { id: 'market', name: 'mARKet', badge: 'SSO', logo: './assets/logos/chat_cube_logo.png', officialUrl: 'https://www.tsionark.com/market' },
    { id: 'linkpay', name: 'KashPlus', badge: 'SSO', logo: './assets/logos/kashplus_logo.png', officialUrl: 'https://www.tsionark.com/linkpay' },
    { id: 'ark', name: 'ARK', badge: 'Ecosystem', logo: './assets/logos/ark_logo.png', officialUrl: 'https://www.tsionark.com/ark' },
    { id: 'tsioncars', name: 'Tsion Cars', badge: 'Ecosystem', logo: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=150&q=80', officialUrl: 'https://www.tsionark.com/tsioncars' }
  ],

  // =============================================
  // PRODUCT COMMUNITY HUBS (Right Sidebar Chat Rooms)
  // =============================================
  PRODUCT_COMMUNITY_HUBS: {
    tsion: {
      name: 'TSION General',
      tagline: 'The media hub and central gathering place for The New Economy.',
      memberCount: '58,400 Members',
      officialUrl: 'https://www.tsionark.com',
      admins: [{ name: 'TSION Admin' }],
      channels: [
        { id: 'tsion-c1', name: '#tsion-general', topic: 'General TSION community discussion', activeNow: 420 }
      ],
      perks: [
        'Real-time ecosystem updates and event schedules',
        'Direct access to TSION verified creators and staff',
        'Live stream reactions and KashCoin gifting'
      ]
    },
    worldstreet: {
      name: 'WorldStreet',
      tagline: '24/7 20x Stock leverage trading & 1-click trade mirroring signals.',
      memberCount: '42,800 Members',
      officialUrl: 'https://www.tsionark.com/worldstreet',
      admins: [{ name: 'WorldStreet Lead' }],
      channels: [
        { id: 'ws-c1', name: '#worldstreet-trades', topic: '24/7 stock leverage signals & trade setups', activeNow: 312 },
        { id: 'ws-c2', name: '#worldstreet-alerts', topic: 'Real-time market alerts & breaking news', activeNow: 185 }
      ],
      perks: [
        'Real-time Apple, Tesla & Nvidia 20x leverage signals',
        'Direct mirror setups from top verified traders',
        'Instant USD bank settlement telemetry via LinkPay'
      ]
    },
    market: {
      name: 'mARKet',
      tagline: 'Onchain peer-to-peer commerce protocol & digital storefronts.',
      memberCount: '34,200 Members',
      officialUrl: 'https://www.tsionark.com/market',
      admins: [{ name: 'mARKet Lead' }],
      channels: [
        { id: 'mk-c1', name: '#market-commerce', topic: 'Peer-to-peer commerce updates & merchant onboarding', activeNow: 247 },
        { id: 'mk-c2', name: '#market-listings', topic: 'New product listings & deals', activeNow: 134 }
      ],
      perks: [
        'Zero-gas merchant store onboarding guides',
        'Direct buyer-to-seller escrow channels',
        'Exclusive New Economy deal drops and masterclasses'
      ]
    },
    linkpay: {
      name: 'LinkPay',
      tagline: 'Borderless instant 2-second USD bank cashouts & zero-fee payments.',
      memberCount: '49,100 Members',
      officialUrl: 'https://www.tsionark.com/linkpay',
      admins: [{ name: 'LinkPay Lead' }],
      channels: [
        { id: 'lp-c1', name: '#linkpay-cashouts', topic: 'USD bank cashout speed reports & settlement updates', activeNow: 389 },
        { id: 'lp-c2', name: '#linkpay-cards', topic: 'Virtual card activation & Apple Pay setup', activeNow: 156 }
      ],
      perks: [
        'Live 2-second cashout velocity telemetry',
        'Apple Pay virtual card activation walkthroughs',
        'Direct support for cross-border offramp routing'
      ]
    },
    ark: {
      name: 'ARK',
      tagline: 'Yield allocation vaults & portfolio auto-rebalancing strategies.',
      memberCount: '28,600 Members',
      officialUrl: 'https://www.tsionark.com/ark',
      admins: [{ name: 'ARK Strategist' }],
      channels: [
        { id: 'ark-c1', name: '#ark-vaults', topic: 'Yield vault strategies & portfolio rebalancing', activeNow: 198 }
      ],
      perks: [
        'Weekly yield vault allocation benchmarks',
        'Auto-rebalancing risk models & strategy logs',
        'Portfolio telemetry and treasury audits'
      ]
    },
    tsioncars: {
      name: 'Tsion Cars',
      tagline: 'Premium automotive marketplace with verified onchain escrow.',
      memberCount: '19,500 Members',
      officialUrl: 'https://www.tsionark.com/tsioncars',
      admins: [{ name: 'Tsion Cars Host' }],
      channels: [
        { id: 'tc-c1', name: '#tsioncars-marketplace', topic: 'Vehicle listings, escrow updates & deliveries', activeNow: 95 }
      ],
      perks: [
        'Verified onchain escrow vehicle delivery logs',
        'Early access to exotic & luxury car listings',
        'Member automotive inspections & escrow claims'
      ]
    }
  },

  // =============================================
  // CREATOR SPOTLIGHTS (Slideshow Video Collages)
  // =============================================
  CREATOR_SPOTLIGHTS: [
    {
      id: 'cr-1',
      name: 'David Okonkwo',
      handle: '@david_trades',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
      product: 'WorldStreet',
      productId: 'worldstreet',
      tag: '🔥 20x Stock Alpha',
      title: '20x TSLA & NVDA Momentum Setup',
      videoUrl: 'xHU5MHuUSKI',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-trading-data-on-a-digital-screen-41712-large.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=600&q=80',
      views: '42.8K',
      duration: '04:12',
      followers: '38.4K',
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500'
    },
    {
      id: 'cr-2',
      name: 'Elena Vance',
      handle: '@elena_pay',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      product: 'KashPlus',
      productId: 'linkpay',
      tag: '⚡ 2-Sec Cashouts',
      title: 'Instant Apple Pay Virtual Card Setup',
      videoUrl: 'p5pf2nCC0oU',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-online-payment-with-a-credit-card-42861-large.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80',
      views: '31.5K',
      duration: '03:45',
      followers: '29.1K',
      gradient: 'from-amber-400 via-orange-500 to-rose-500'
    },
    {
      id: 'cr-3',
      name: 'Amina Bello',
      handle: '@amina_market',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      product: 'mARKet',
      productId: 'market',
      tag: '🛍️ Zero-Gas Commerce',
      title: 'Building a $50k Digital Storefront',
      videoUrl: '0RaEHAv-PvM',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-woman-holding-a-smartphone-with-a-green-screen-41077-large.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80',
      views: '26.9K',
      duration: '05:20',
      followers: '44.2K',
      gradient: 'from-purple-500 via-pink-500 to-rose-500'
    },
    {
      id: 'cr-4',
      name: 'Alex Rivera',
      handle: '@alex_vaults',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      product: 'ARK',
      productId: 'ark',
      tag: '📈 Yield Allocation',
      title: 'Automated Portfolio Rebalancing',
      videoUrl: 'SqBx7QADBes',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-financial-graphs-and-charts-on-a-screen-41714-large.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=600&q=80',
      views: '35.4K',
      duration: '06:10',
      followers: '51.8K',
      gradient: 'from-cyan-500 via-blue-500 to-indigo-500'
    },
    {
      id: 'cr-5',
      name: 'Kofi Mensah',
      handle: '@kofi_autos',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      product: 'Tsion Cars',
      productId: 'tsioncars',
      tag: '🏎️ Smart Escrow',
      title: 'Supercar Escrow Handover Day',
      videoUrl: 'Ly000aJgJFc',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-luxury-sports-car-speeding-on-a-highway-42878-large.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=600&q=80',
      views: '19.8K',
      duration: '04:55',
      followers: '22.6K',
      gradient: 'from-emerald-400 via-amber-400 to-red-500'
    },
    {
      id: 'cr-6',
      name: 'Sarah Jenkins',
      handle: '@sarah_quant',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      product: 'WorldStreet',
      productId: 'worldstreet',
      tag: '⚡ Quant Signals',
      title: '24/7 Weekend Market Volatility Map',
      videoUrl: 'xHU5MHuUSKI',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-stock-exchange-graph-data-on-a-screen-41716-large.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
      views: '48.1K',
      duration: '07:30',
      followers: '63.9K',
      gradient: 'from-blue-500 via-teal-400 to-emerald-400'
    }
  ],

  // =============================================
  // INITIAL MEDIA ROWS (Center Feed Video Collages)
  // =============================================
  INITIAL_MEDIA_ROWS: [
    {
      id: 'row-official',
      title: 'Official Product Masterclasses & Explainer Highlights',
      subtitle: 'TSION-produced breakdowns of WorldStreet, mARKet, LinkPay, ARK & Tsion Cars.',
      direction: 'left',
      isVertical: false,
      items: [
        { id: 'v1', title: 'WorldStreet 20x Stock Leverage Live Masterclass', productId: 'worldstreet', productName: 'WorldStreet', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80', duration: '24:10', views: '48.2K', likes: 3420 },
        { id: 'v2', title: 'LinkPay 2-Second USD Bank Cashout Settlement Demo', productId: 'linkpay', productName: 'LinkPay', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80', duration: '08:45', views: '32.1K', likes: 2180 },
        { id: 'v3', title: 'mARKet P2P Commerce Protocol Onboarding Walkthrough', productId: 'market', productName: 'mARKet', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80', duration: '18:10', views: '29.5K', likes: 1950 },
        { id: 'v4', title: 'ARK Yield Vault Auto-Rebalancing Strategy Guide', productId: 'ark', productName: 'ARK', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80', duration: '15:30', views: '18.7K', likes: 1340 },
        { id: 'v5', title: 'Tsion Cars Verified Escrow Vehicle Delivery Process', productId: 'tsioncars', productName: 'Tsion Cars', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80', duration: '12:20', views: '14.3K', likes: 890 },
        { id: 'v6', title: 'LinkPay Global Virtual Card & Apple Pay Integration Deep Dive', productId: 'linkpay', productName: 'LinkPay', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80', duration: '10:15', views: '25.6K', likes: 1840 },
        { id: 'v7', title: 'WorldStreet 1-Click Copy Trading & Signal Telemetry', productId: 'worldstreet', productName: 'WorldStreet', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80', duration: '14:50', views: '38.9K', likes: 2790 },
        { id: 'v8', title: 'mARKet Zero-Gas Escrow Swaps & Merchant Payments', productId: 'market', productName: 'mARKet', influencer: 'TSION Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80', duration: '16:40', views: '21.4K', likes: 1620 }
      ]
    },
    {
      id: 'row-creators',
      title: 'Top Creator Reflections & Signal Breakdowns',
      subtitle: 'Community creators sharing trade setups, cashout reports, and ecosystem experiences.',
      direction: 'right',
      isVertical: false,
      items: [
        { id: 'c1', title: 'My First 20x TSLA Trade on WorldStreet — Full Breakdown', productId: 'worldstreet', productName: 'WorldStreet', influencer: 'David Okonkwo', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80', duration: '14:20', views: '22.8K', likes: 1820 },
        { id: 'c2', title: 'LinkPay Apple Pay Virtual Card Activation in 60 Seconds', productId: 'linkpay', productName: 'LinkPay', influencer: 'Elena Vance', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80', duration: '06:15', views: '19.4K', likes: 1560 },
        { id: 'c3', title: 'Setting Up My mARKet Digital Storefront — Merchant Guide', productId: 'market', productName: 'mARKet', influencer: 'Amina Bello', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80', duration: '11:50', views: '15.2K', likes: 1120 },
        { id: 'c4', title: 'WorldStreet NVDA 20x Position — Real-Time PnL Breakdown', productId: 'worldstreet', productName: 'WorldStreet', influencer: 'Dave Trades', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80', duration: '09:40', views: '27.1K', likes: 2340 },
        { id: 'c5', title: 'Tsion Cars Delivery Day — My Experience with Onchain Escrow', productId: 'tsioncars', productName: 'Tsion Cars', influencer: 'Kofi Mensah', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80', duration: '16:05', views: '11.8K', likes: 780 },
        { id: 'c6', title: 'How LinkPay 2-Second USD Offramps Changed My Creator Income', productId: 'linkpay', productName: 'LinkPay', influencer: 'Elena Vance', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80', duration: '08:30', views: '31.2K', likes: 2450 },
        { id: 'c7', title: 'ARK Vault Portfolio Rebalancing Tutorial for Beginners', productId: 'ark', productName: 'ARK', influencer: 'Alex Trader', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', thumbnail: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80', duration: '13:45', views: '16.9K', likes: 1290 }
      ]
    }
  ],

  // =============================================
  // INITIAL POSTS (Official Accounts & Products Feed)
  // =============================================
  INITIAL_POSTS: [
    {
      id: 'post-neu-1',
      author: 'NEU TV Official',
      handle: '@neutv',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      verified: true,
      productId: 'neutv',
      productName: 'NEU TV',
      categoryTag: '📢 Network Broadcast',
      role: 'Global Media Network',
      bio: 'The media network for the new economy. Master wealth, 20x trade signals, and 24/7 central broadcasting.',
      followers: '148.5K',
      isFollowing: true,
      timestamp: 'Just now',
      videoTitle: 'NEU TV Market Intel: Macro Liquidity & Institutional Alpha Stream',
      duration: '18:40',
      views: '54.8K',
      youtubeId: 'xHU5MHuUSKI',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-stock-exchange-graph-data-on-a-screen-41716-large.mp4',
      mediaUrl: 'https://img.youtube.com/vi/xHU5MHuUSKI/maxresdefault.jpg',
      content: 'Welcome to NEU TV — The New Economy, On Screen. 📺 24/7 live continuous market coverage, institutional trading signals, and instant LinkPay settlement breakdowns. Stream live with us right now! #NEUTV #NewEconomy #LiveBroadcast #WealthSignals',
      upvotes: 4820,
      shares: 1240,
      isUpvoted: true,
      isSaved: false,
      comments: [
        { id: 'c1', author: 'WorldStreet Host', handle: '@worldstreet', avatar: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=150&q=80', text: 'Live NVDA 20x signals are syncing directly to the broadcast!', timestamp: '2m ago', likes: 48 },
        { id: 'c2', author: 'KashPlus Desk', handle: '@kashplus', avatar: './assets/logos/kashplus_logo.png', text: 'Offramp telemetry running at 1.8s average settlement speed. ⚡', timestamp: '5m ago', likes: 32 }
      ]
    },
    {
      id: 'post-ws-1',
      author: 'NEU TV Official',
      handle: '@neutv',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      verified: true,
      productId: 'worldstreet',
      productName: 'WorldStreet',
      categoryTag: '⚡ WorldStreet Coverage',
      role: 'Global Media Network',
      bio: 'The media network for the new economy. Master wealth, 20x trade signals, and 24/7 central broadcasting.',
      followers: '148.5K',
      isFollowing: true,
      timestamp: '25m ago',
      videoTitle: 'NEU TV Special: TSLA & NVDA 20x Breakout Strategy Breakdown',
      duration: '14:50',
      views: '38.4K',
      youtubeId: 'Ly000aJgJFc',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-trading-data-on-a-digital-screen-41712-large.mp4',
      mediaUrl: 'https://img.youtube.com/vi/Ly000aJgJFc/maxresdefault.jpg',
      content: '🚨 NEU TV OFFICIAL REPORT: 20x Stock Leverage Masterclass streaming live on WorldStreet. How top traders are capturing double-digit alpha on Apple, Tesla, and Nvidia during weekend hours. #WorldStreet #StockLeverage #TradingSignals #Alpha',
      upvotes: 3420,
      shares: 890,
      isUpvoted: false,
      isSaved: true,
      comments: []
    },
    {
      id: 'post-lp-1',
      author: 'NEU TV Official',
      handle: '@neutv',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      verified: true,
      productId: 'linkpay',
      productName: 'KashPlus',
      categoryTag: '💳 KashPlus Telemetry',
      role: 'Global Media Network',
      bio: 'The media network for the new economy. Master wealth, 20x trade signals, and 24/7 central broadcasting.',
      followers: '148.5K',
      isFollowing: true,
      timestamp: '1h ago',
      videoTitle: 'NEU TV Feature: 2-Second USD Cashout Speed Test & KashPlus Telemetry',
      duration: '08:15',
      views: '42.1K',
      youtubeId: 'p5pf2nCC0oU',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-online-payment-with-a-credit-card-42861-large.mp4',
      mediaUrl: 'https://img.youtube.com/vi/p5pf2nCC0oU/maxresdefault.jpg',
      content: '📢 NEU TV NETWORK ANNOUNCEMENT: From trading profits on WorldStreet to your local bank account in 2 seconds flat. 💳 Watch the real-time velocity stress test and learn how KashPlus instant USD settlement operates. #KashPlus #FastCashout #InstantSettlement #Fintech',
      upvotes: 2940,
      shares: 720,
      isUpvoted: false,
      isSaved: false,
      comments: []
    },
    {
      id: 'post-mk-1',
      author: 'NEU TV Official',
      handle: '@neutv',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      verified: true,
      productId: 'market',
      productName: 'mARKet',
      categoryTag: '🛍️ mARKet Spotlight',
      role: 'Global Media Network',
      bio: 'The media network for the new economy. Master wealth, 20x trade signals, and 24/7 central broadcasting.',
      followers: '148.5K',
      isFollowing: true,
      timestamp: '3h ago',
      videoTitle: 'NEU TV Showcase: Zero-Gas Merchant Storefront Setup & Escrow Security',
      duration: '22:30',
      views: '29.3K',
      youtubeId: '0RaEHAv-PvM',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-woman-holding-a-smartphone-with-a-green-screen-41077-large.mp4',
      mediaUrl: 'https://img.youtube.com/vi/0RaEHAv-PvM/maxresdefault.jpg',
      content: '🛍️ NEU TV SPECIAL REPORT: Over 5,000 merchants have launched on mARKet this month! Learn how zero-gas architecture and smart escrow guarantee 100% buyer-seller protection on all physical and digital merchandise. #mARKet #P2PCommerce #ZeroGas #Storefront',
      upvotes: 2180,
      shares: 510,
      isUpvoted: false,
      isSaved: false,
      comments: []
    },
    {
      id: 'post-ark-1',
      author: 'NEU TV Official',
      handle: '@neutv',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      verified: true,
      productId: 'ark',
      productName: 'ARK',
      categoryTag: '📊 ARK Vaults Report',
      role: 'Global Media Network',
      bio: 'The media network for the new economy. Master wealth, 20x trade signals, and 24/7 central broadcasting.',
      followers: '148.5K',
      isFollowing: true,
      timestamp: '5h ago',
      videoTitle: 'NEU TV Treasury: ARK Yield Optimization & Rebalancing Log',
      duration: '16:40',
      views: '35.7K',
      youtubeId: 'SqBx7QADBes',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-financial-graphs-and-charts-on-a-screen-41714-large.mp4',
      mediaUrl: 'https://img.youtube.com/vi/SqBx7QADBes/maxresdefault.jpg',
      content: '📊 NEU TV TREASURY UPDATE: Portfolio auto-rebalancing strategies on ARK Yield Vaults have maintained benchmark-beating stability through market volatility. Full treasury audit & strategy breakdown inside. #ARK #YieldVaults #DeFi #WealthManagement',
      upvotes: 3890,
      shares: 940,
      isUpvoted: false,
      isSaved: false,
      comments: []
    },
    {
      id: 'post-tc-1',
      author: 'NEU TV Official',
      handle: '@neutv',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      verified: true,
      productId: 'tsioncars',
      productName: 'Tsion Cars',
      categoryTag: '🚗 Tsion Cars Delivery',
      role: 'Global Media Network',
      bio: 'The media network for the new economy. Master wealth, 20x trade signals, and 24/7 central broadcasting.',
      followers: '148.5K',
      isFollowing: true,
      timestamp: '8h ago',
      videoTitle: 'NEU TV Delivery Day: Exotic Car Delivery & Verified Escrow in Action',
      duration: '12:10',
      views: '24.6K',
      youtubeId: 'xHU5MHuUSKI',
      videoMp4: 'https://assets.mixkit.co/videos/preview/mixkit-luxury-sports-car-speeding-on-a-highway-42878-large.mp4',
      mediaUrl: 'https://img.youtube.com/vi/xHU5MHuUSKI/maxresdefault.jpg',
      content: '🚗 NEU TV FIELD REPORT: From showroom to driveway: Watch how Tsion Cars verified onchain escrow ensures flawless title authentication and instant fund release upon vehicle delivery. #TsionCars #LuxuryAutos #SmartEscrow #Supercars',
      upvotes: 1950,
      shares: 430,
      isUpvoted: false,
      isSaved: false,
      comments: []
    }
  ],

  PLATFORMS: [
    { id: 'worldstreet', name: 'WorldStreet', tag: '24/7 Stock Leverage', badge: 'Primary SSO', description: '24/7 20x Stock leverage trading on Apple, Tesla & Nvidia.', url: 'https://www.tsionark.com/worldstreet' },
    { id: 'market', name: 'mARKet', tag: 'Commerce Protocol', badge: 'Primary SSO', description: 'The New Economy marketplace and peer-to-peer commerce hub.', url: 'https://www.tsionark.com/market' },
    { id: 'linkpay', name: 'KashPlus', tag: 'Instant Payments', badge: 'Primary SSO', description: 'Borderless instant USD bank cashouts & zero-fee payments.', url: 'https://www.tsionark.com/linkpay' },
    { id: 'ark', name: 'ARK', tag: 'Yield Vaults', badge: 'Ecosystem', description: 'Yield allocation vaults & portfolio auto-rebalancing.', url: 'https://www.tsionark.com/ark' },
    { id: 'tsioncars', name: 'Tsion Cars', tag: 'Vehicle Hub', badge: 'Ecosystem', description: 'Premium automotive marketplace for The New Economy.', url: 'https://www.tsionark.com/tsioncars' }
  ],

  // 5.1 SCHEDULE / "WHAT'S ON" LINEAR PROGRAMMING GRID
  SCHEDULE_ITEMS: [
    { id: 's1', time: '18:00 - 18:30', title: 'Daily New Economy Briefing', category: 'Live News', platform: 'WorldStreet', duration: '30 mins', isCurrent: true },
    { id: 's2', time: '18:30 - 19:15', title: 'WorldStreet 20x Stock Leverage Masterclass', category: 'Trading Class', platform: 'WorldStreet', duration: '45 mins', isCurrent: false },
    { id: 's3', time: '19:15 - 19:45', title: 'LinkPay 2-Second USD Cashout Telemetry', category: 'Product Showcase', platform: 'LinkPay', duration: '30 mins', isCurrent: false },
    { id: 's4', time: '19:45 - 20:30', title: 'mARKet Peer-to-Peer Commerce Deep Dive', category: 'Explainer', platform: 'mARKet', duration: '45 mins', isCurrent: false },
    { id: 's5', time: '20:30 - 21:30', title: 'NEU Global Network & Leadership Keynote', category: 'Event Coverage', platform: 'NEU TV', duration: '60 mins', isCurrent: false }
  ],

  // 5.1 INITIAL HERO BROADCAST & VOD LIBRARY
  INITIAL_CENTRAL_TV: {
    id: 'tv-live-1',
    title: 'NEU TV Live: The New Economy Central Broadcast Stream',
    product: 'NEU Universe & Ecosystem',
    productId: 'worldstreet',
    streamer: 'NEU Media Network',
    streamerRole: 'Official Central Stream',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    isLive: true,
    viewers: 34200,
    likes: 89400,
    shares: 18200,
    description: 'NEU TV is where innovation meets inspiration. We tell the stories, share the insights, and spark the conversations shaping tomorrow.',
    banner: 'https://img.youtube.com/vi/SqBx7QADBes/maxresdefault.jpg',
    youtubeId: 'SqBx7QADBes',
    videoUrl: 'https://www.youtube-nocookie.com/embed/SqBx7QADBes?autoplay=1&mute=1&loop=1&playlist=SqBx7QADBes&controls=0&disablekb=1&rel=0&modestbranding=1&enablejsapi=1&iv_load_policy=3&playsinline=1',
    posterUrl: 'https://img.youtube.com/vi/SqBx7QADBes/maxresdefault.jpg',
    campaignCta: 'Explore Ecosystem Hubs ↗',
    campaignUrl: 'https://www.tsionark.com'
  },

  VOD_LIBRARY: [
    {
      id: 'vod-1',
      title: 'Daily New Economy Briefing: Macro Telemetry & Cashout Velocity',
      platform: 'WorldStreet',
      platformId: 'worldstreet',
      duration: '14:20',
      views: '48.2K',
      thumbnail: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=600&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      description: 'Daily briefing analyzing WorldStreet stock leverage volume and LinkPay instant USD offramp metrics.'
    },
    {
      id: 'vod-2',
      title: 'LinkPay 2-Second USD Bank Cashout Settlement Walkthrough',
      platform: 'LinkPay',
      platformId: 'linkpay',
      duration: '08:45',
      views: '32.1K',
      thumbnail: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      description: 'Step-by-step guide to instant zero-fee USD cashouts via LinkPay superapp.'
    },
    {
      id: 'vod-3',
      title: 'mARKet Protocol: Onchain Peer-to-Peer Commerce Explained',
      platform: 'mARKet',
      platformId: 'market',
      duration: '18:10',
      views: '29.5K',
      thumbnail: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=600&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      description: 'How mARKet connects buyers and merchants in The New Economy ecosystem.'
    }
  ],

  // 5.2 HASHTAG AGGREGATION FEED DATASET (WITH MASONRY, SOURCES, FEATURED PINNING & MODERATION)
  HASHTAG_FEEDS: [
    { id: 'f1', name: 'New Economy Evergreen', hashtags: ['#TheNewEconomy', '#WorldStreet', '#ARKbyTSION'], status: 'live', moderation: 'Approve-before-publish' },
    { id: 'f2', name: 'TSION Banquet Event', hashtags: ['#TSIONBanquet', '#TsionCars'], status: 'live', moderation: 'Approve-before-publish' }
  ],

  AGGREGATED_HASHTAG_POSTS: [
    {
      id: 'hp-1',
      author: 'David Okonkwo',
      handle: '@david_tech',
      platformBadge: 'WorldStreet Member',
      source: 'X',
      sourceIcon: 'twitter',
      hashtag: '#TheNewEconomy',
      timestamp: '12m ago',
      content: 'Just executed my first 20x stock trade on WorldStreet! Settlement via LinkPay took literally 2 seconds. The New Economy is real. 🚀',
      mediaUrl: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80',
      likes: 342,
      isFeatured: true,
      moderated: true
    },
    {
      id: 'hp-2',
      author: 'Amina Bello',
      handle: '@amina_commerce',
      platformBadge: 'mARKet Member',
      source: 'Instagram',
      sourceIcon: 'instagram',
      hashtag: '#mARKet',
      timestamp: '45m ago',
      content: 'Listed my digital storefront goods on mARKet today! Seamless integration with TSION identity. #TheNewEconomy #mARKet',
      mediaUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
      likes: 218,
      isFeatured: true,
      moderated: true
    },
    {
      id: 'hp-3',
      author: 'Emeka Vance',
      handle: '@emeka_fintech',
      platformBadge: 'LinkPay Member',
      source: 'LinkedIn',
      sourceIcon: 'linkedin',
      hashtag: '#LinkPay',
      timestamp: '2h ago',
      content: 'The speed of LinkPay USD offramps is setting new institutional standards across West Africa. #WorldStreet #LinkPay',
      mediaUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
      likes: 512,
      isFeatured: false,
      moderated: true
    },
    {
      id: 'hp-4',
      author: 'Kofi Mensah',
      handle: '@kofi_autoclub',
      platformBadge: 'Tsion Cars Member',
      source: 'TikTok',
      sourceIcon: 'video',
      hashtag: '#TsionCars',
      timestamp: '3h ago',
      content: 'Took delivery of my vehicle through Tsion Cars marketplace! Verified onchain escrow. #TsionCars #TheNewEconomy',
      mediaUrl: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80',
      likes: 890,
      isFeatured: false,
      moderated: true
    }
  ],

  // 5.3 MODERATED LIVE CHAT STREAM FOR LIVE CHANNEL
  SAMPLE_LIVE_COMMENTS: [
    { id: 1, author: 'Mark Crypto', badge: 'WorldStreet Member', text: 'Look at that LinkPay USD cashout speed on screen! 2 seconds straight into bank account ⚡', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80' },
    { id: 2, author: 'Sarah DeFi', badge: 'mARKet Member', text: 'mARKet P2P commerce protocol just triggered a zero-gas swap live on broadcast! 🔥', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80' },
    { id: 3, author: 'Dave Trades', badge: 'WorldStreet Member', text: 'WorldStreet 20x stock leverage position on TSLA is pumping hard in this video breakdown! 📈', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80' },
    { id: 4, author: 'Elena Vance', badge: 'LinkPay Member', text: 'LinkPay Apple Pay card virtual activation demo just showed instant settlement 💳', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80' }
  ],

  TRENDING_TOPICS: [
    { id: 't1', category: 'Fiat Offramp · Trending', topic: '#LinkPayInstant', postsCount: '48.2K posts', snippet: 'LinkPay 2-second USD bank withdrawals hit record daily volume.' },
    { id: 't2', category: 'Stock Trading · Live Gist', topic: '#WorldStreet20x', postsCount: '34.1K posts', snippet: 'Traders leveraging Apple & Tesla 20x 24/7 on WorldStreet platform.' },
    { id: 't3', category: 'P2P Commerce · Breaking', topic: '#mARKetProtocol', postsCount: '29.8K posts', snippet: 'mARKet merchant transaction volume crosses $4.2M.' }
  ]
};
