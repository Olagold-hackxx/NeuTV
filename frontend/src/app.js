(function() {
  const data = window.CentralData || {};
  const FALLBACK_PRODUCTS = [
    { id: 'worldstreet', name: 'WorldStreet', tag: '24/7 Stock Leverage', logo: './assets/logos/ark_logo.png' },
    { id: 'market', name: 'mARKet', tag: 'P2P Commerce', logo: './assets/logos/chat_cube_logo.png' },
    { id: 'linkpay', name: 'KashPlus', tag: 'Instant Payments', logo: './assets/logos/kashplus_logo.png' },
    { id: 'ark', name: 'ARK', tag: 'Yield Vaults', logo: './assets/logos/ark_logo.png' },
    { id: 'tsioncars', name: 'Tsion Cars', tag: 'Vehicle Hub', logo: './assets/logos/ark_logo.png' }
  ];
  const PRODUCTS = (data.PRODUCTS && data.PRODUCTS.length > 0) ? data.PRODUCTS : FALLBACK_PRODUCTS;
  const PRODUCT_COMMUNITY_HUBS = data.PRODUCT_COMMUNITY_HUBS || {};
  const INITIAL_CENTRAL_TV = data.INITIAL_CENTRAL_TV || {};
  const SAMPLE_LIVE_COMMENTS = data.SAMPLE_LIVE_COMMENTS || [];
  const INITIAL_MEDIA_ROWS = data.INITIAL_MEDIA_ROWS || [];
  const INITIAL_POSTS = data.INITIAL_POSTS || [];
  const TRENDING_TOPICS = data.TRENDING_TOPICS || [];
  const PLATFORMS = data.PLATFORMS || [];
  const SCHEDULE_ITEMS = data.SCHEDULE_ITEMS || [];
  const VOD_LIBRARY = data.VOD_LIBRARY || [];
  const CREATOR_SPOTLIGHTS = data.CREATOR_SPOTLIGHTS || [];

  const ReactObj = window.React || {};
  const { useState, useEffect, useMemo, useRef, createElement: h } = ReactObj;

  const EMOJIS = ['❤️', '🔥', '👏', '🎉', '🚀', '⭐', '💖', '💎'];

  const GIFTS = [
    { id: 'giftbox', name: 'Luxury Gift Box', emoji: '🎁', cost: 1000, label: '1,000 Coins' },
    { id: 'crown', name: 'Royal Crown', emoji: '👑', cost: 500, label: '500 Coins' },
    { id: 'diamond', name: 'Diamond Gem', emoji: '💎', cost: 250, label: '250 Coins' },
    { id: 'rocket', name: 'Rocket Booster', emoji: '🚀', cost: 100, label: '100 Coins' },
    { id: 'flame', name: 'Super Flame', emoji: '🔥', cost: 50, label: '50 Coins' },
    { id: 'trophy', name: 'Golden Trophy', emoji: '🏆', cost: 75, label: '75 Coins' },
    { id: 'car', name: 'Supercar Key', emoji: '🏎️', cost: 350, label: '350 Coins' },
    { id: 'spike', name: 'Kash Spike', emoji: '⚡', cost: 25, label: '25 Coins' },
    { id: 'applause', name: 'Applause', emoji: '👏', cost: 10, label: '10 Coins' }
  ];

  function App() {
    // Refresh Lucide icons on every state change
    useEffect(() => {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    });

    // Authentication & SSO State
    const [currentUser, setCurrentUser] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [isGateOpen, setIsGateOpen] = useState(false);

    // Coin Balance State (No sign-in bonus)
    const [coinBalance, setCoinBalance] = useState(0);
    const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);

    // Navigation & Selected Product State (Left Sidebar)
    const [activeProductId, setActiveProductId] = useState('all');
    const [expandedServerId, setExpandedServerId] = useState(null);
    const [activeMainTab, setActiveMainTab] = useState('tv'); // 'tv' | 'channels' | 'schedule'
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    
    // Player & Viewing State
    const [centralTv, setCentralTv] = useState(INITIAL_CENTRAL_TV);
    const [isMuted, setIsMuted] = useState(true);
    const [qualityMode, setQualityMode] = useState('1080p');
    const [isMiniPlayer, setIsMiniPlayer] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);

    // Feed & Content State
    const [mediaRows, setMediaRows] = useState(INITIAL_MEDIA_ROWS);
    const [posts, setPosts] = useState(INITIAL_POSTS);
    const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

    // RIGHT SIDEBAR COMMUNITY CHAT ROOM & MEMBERSHIP STATE
    const [joinedCommunities, setJoinedCommunities] = useState({});
    const [activeCommunityServerId, setActiveCommunityServerId] = useState('worldstreet');
    const [activeCommunityChannelId, setActiveCommunityChannelId] = useState('ws-c1');
    const [communityMessages, setCommunityMessages] = useState({
      'tsion-c1': [
        { id: 101, author: 'Mark Crypto', role: 'WorldStreet Lead', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', timestamp: '2:14 PM', text: 'Welcome to TSION General! The New Economy is building every day.', reactions: { '🔥': 24 } },
        { id: 102, author: 'Alex Trader', role: 'mARKet Member', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', timestamp: '2:16 PM', text: 'Glad to be part of this community. The ecosystem is growing fast!', reactions: { '⚡': 18 } }
      ],
      'ws-c1': [
        { id: 201, author: 'Dave Trades', role: 'WorldStreet Master', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', timestamp: '3:05 PM', text: '24/7 Tesla 20x stock leverage position open on WorldStreet. Looking strong!', reactions: { '🚀': 52 } },
        { id: 202, author: 'David Okonkwo', role: 'WorldStreet Member', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', timestamp: '3:12 PM', text: 'AAPL 20x long. Settlement in 2s via LinkPay confirmed ⚡', reactions: { '📈': 31 } }
      ],
      'ws-c2': [
        { id: 211, author: 'Mark Crypto', role: 'WorldStreet Lead', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', timestamp: '2:50 PM', text: '🚨 Alert: NVDA crossing key resistance level. Watch for breakout.', reactions: { '🔥': 45 } }
      ],
      'mk-c1': [
        { id: 301, author: 'Amina Bello', role: 'mARKet Lead', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', timestamp: '1:30 PM', text: 'New merchant onboarding flow is live! P2P commerce just got smoother.', reactions: { '🎉': 28 } },
        { id: 302, author: 'Alex Trader', role: 'mARKet Member', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', timestamp: '1:45 PM', text: 'Just listed my first product. Zero-gas swap is incredible.', reactions: { '✨': 19 } }
      ],
      'mk-c2': [
        { id: 311, author: 'Amina Bello', role: 'mARKet Lead', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', timestamp: '12:00 PM', text: 'Fresh listings dropping today — premium digital goods!', reactions: { '🛒': 15 } }
      ],
      'lp-c1': [
        { id: 401, author: 'Elena Vance', role: 'LinkPay Lead', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', timestamp: '1:10 PM', text: 'LinkPay USD bank cashout settled in 2 seconds flat. New record volume today!', reactions: { '⚡': 35 } },
        { id: 402, author: 'Mark Crypto', role: 'LinkPay Member', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', timestamp: '1:25 PM', text: 'Offramped $12.5k via LinkPay in 2 seconds after WorldStreet signals!', reactions: { '💰': 22 } }
      ],
      'lp-c2': [
        { id: 411, author: 'Elena Vance', role: 'LinkPay Lead', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', timestamp: '11:30 AM', text: 'Apple Pay virtual card activation guide pinned above 👆', reactions: { '💳': 40 } }
      ],
      'ark-c1': [
        { id: 501, author: 'TSION Official', role: 'ARK Strategist', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', timestamp: '10:00 AM', text: 'ARK Yield Vault rebalancing complete. Performance above projected benchmarks this quarter.', reactions: { '📊': 33 } }
      ],
      'tc-c1': [
        { id: 601, author: 'Kofi Mensah', role: 'Tsion Cars Member', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', timestamp: '9:30 AM', text: 'Vehicle delivery confirmed via onchain escrow. Seamless process! 🚗', reactions: { '🎉': 27 } }
      ]
    });
    const [rightChatInputText, setRightChatInputText] = useState('');

    // Player Interaction & Flying Animations
    const [tvLikes, setTvLikes] = useState(centralTv.likes || 64200);
    const [isTvLiked, setIsTvLiked] = useState(false);
    const [flyingHearts, setFlyingHearts] = useState([]);
    const [liveCommentIndex, setLiveCommentIndex] = useState(0);
    const [activeLiveComments, setActiveLiveComments] = useState(SAMPLE_LIVE_COMMENTS.slice(0, 3));
    const [chatInputText, setChatInputText] = useState('');
    const [activeGiftBanner, setActiveGiftBanner] = useState(null);
    const [pausedRows, setPausedRows] = useState({});

    // Form State
    const [newPostText, setNewPostText] = useState('');
    const [newPostProduct, setNewPostProduct] = useState('worldstreet');
    const [newPostMedia, setNewPostMedia] = useState('');
    const [commentInputs, setCommentInputs] = useState({});
    const [followingUsers, setFollowingUsers] = useState({
      '@neutv': true,
      '@worldstreet': true,
      '@linkpay': true,
      '@market': false,
      '@ark': true,
      '@tsioncars': false
    });

    const [likedPosts, setLikedPosts] = useState({ 'post-neu-1': true, 'post-ws-1': true });
    const [savedPosts, setSavedPosts] = useState({ 'post-ws-1': true });
    const [openCommentSections, setOpenCommentSections] = useState({ 'post-neu-1': true });
    const [postCommentInputs, setPostCommentInputs] = useState({});
    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 2600);
    };

    // Follow / Unfollow Creator Handler
    const handleToggleFollow = (authorHandle) => {
      requireAuth('follow creators', () => {
        setFollowingUsers(prev => {
          const isFollowing = !prev[authorHandle];
          showToast(isFollowing ? `Now following ${authorHandle}!` : `Unfollowed ${authorHandle}`);
          return {
            ...prev,
            [authorHandle]: isFollowing
          };
        });
      });
    };

    const handleTogglePostLike = (postId) => {
      requireAuth('like posts', () => {
        setLikedPosts(prev => {
          const isLiked = !prev[postId];
          setPosts(currPosts => currPosts.map(p => {
            if (p.id === postId) {
              return {
                ...p,
                upvotes: isLiked ? (p.upvotes || 0) + 1 : Math.max(0, (p.upvotes || 1) - 1),
                isUpvoted: isLiked
              };
            }
            return p;
          }));
          return { ...prev, [postId]: isLiked };
        });
        spawnHeart('❤️');
      });
    };

    const handleToggleSavePost = (postId) => {
      requireAuth('save posts', () => {
        setSavedPosts(prev => {
          const isSaved = !prev[postId];
          showToast(isSaved ? 'Post saved to bookmarks! 🔖' : 'Removed from bookmarks');
          return { ...prev, [postId]: isSaved };
        });
      });
    };

    const toggleComments = (postId) => {
      setOpenCommentSections(prev => ({
        ...prev,
        [postId]: !prev[postId]
      }));
    };

    const handleAddPostComment = (e, postId) => {
      e.preventDefault();
      const text = postCommentInputs[postId];
      if (!text || !text.trim()) return;

      requireAuth('comment on posts', () => {
        const newC = {
          id: 'c_' + Date.now(),
          author: currentUser ? currentUser.name : 'NEU Viewer',
          handle: currentUser ? currentUser.name : '@viewer',
          avatar: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          text: text.trim(),
          timestamp: 'Just now',
          likes: 0
        };

        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: [...(p.comments || []), newC]
            };
          }
          return p;
        }));

        setPostCommentInputs(prev => ({ ...prev, [postId]: '' }));
        setOpenCommentSections(prev => ({ ...prev, [postId]: true }));
        showToast('Comment posted! 💬');
      });
    };

    const handleSharePost = (post) => {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares: (p.shares || 0) + 1 } : p));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.origin + '?post=' + post.id);
      }
      showToast('Link copied to clipboard! 📋');
    };

    const handlePostReactionEmoji = (postId, emoji) => {
      requireAuth('react', () => {
        spawnHeart(emoji);
        showToast(`Reacted ${emoji}!`);
      });
    };

    // Hero Player Ref
    const heroPlayerRef = useRef(null);

    useEffect(() => {
      const handleScroll = () => {
        if (heroPlayerRef.current) {
          const rect = heroPlayerRef.current.getBoundingClientRect();
          if (rect.bottom < 80) {
            setIsMiniPlayer(true);
          } else {
            setIsMiniPlayer(false);
          }
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Flying Hearts Spawner
    useEffect(() => {
      const heartInterval = setInterval(() => {
        spawnHeart();
      }, 1400);

      return () => clearInterval(heartInterval);
    }, []);

    // Live Comments Stream
    useEffect(() => {
      const commentInterval = setInterval(() => {
        setLiveCommentIndex(prev => {
          const comments = SAMPLE_LIVE_COMMENTS || [];
          if (comments.length === 0) return 0;
          const nextIdx = (prev + 1) % comments.length;
          const newComment = { ...comments[nextIdx], uniqueId: Date.now() };
          setActiveLiveComments(curr => [newComment, ...curr.slice(0, 2)]);
          return nextIdx;
        });
      }, 3500);

      return () => clearInterval(commentInterval);
    }, []);

    // Active product community hub details
    const activeCommunityHub = useMemo(() => {
      return PRODUCT_COMMUNITY_HUBS[activeCommunityServerId] || PRODUCT_COMMUNITY_HUBS['tsion'] || { name: 'Tsion', officialUrl: 'https://www.tsionark.com', channels: [{ id: 'tsion-c1', name: '#tsion-copy-trading', activeNow: 420 }] };
    }, [activeCommunityServerId]);

    // Active channel details
    const activeChannelObj = useMemo(() => {
      const channels = activeCommunityHub.channels || [{ id: 'tsion-c1', name: '#tsion-copy-trading', topic: 'General discussion', activeNow: 420 }];
      return channels.find(c => c.id === activeCommunityChannelId) || channels[0];
    }, [activeCommunityHub, activeCommunityChannelId]);

    // Open Access Handlers
    const requireAuth = (actionName, callback) => {
      if (callback) callback();
    };

    const [selectedSSO, setSelectedSSO] = useState(null);
    const [ssoForm, setSsoForm] = useState({ username: '', password: '' });
    const [authMode, setAuthMode] = useState('signup');
    const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', platform: 'worldstreet' });
    const [authPoppingEmojis, setAuthPoppingEmojis] = useState([]);
    const [celebrationModal, setCelebrationModal] = useState(null);
    const [confettiList, setConfettiList] = useState([]);

    // Spawner for auth page popping gifts/reactions
    const spawnAuthReaction = (customX) => {
      const reactionIcons = ['💖', '🎁', '🪙', '✨', '🎉', '🔥', '💎', '👑', '❤️', '🚀'];
      const icon = reactionIcons[Math.floor(Math.random() * reactionIcons.length)];
      const id = Date.now() + Math.random();
      const leftPos = customX !== undefined ? customX : (Math.random() < 0.5 ? (4 + Math.random() * 20) : (76 + Math.random() * 20));
      const size = 1.3 + Math.random() * 1.1;
      
      setAuthPoppingEmojis(prev => [...prev.slice(-20), { id, icon, leftPos, size }]);
      setTimeout(() => {
        setAuthPoppingEmojis(prev => prev.filter(item => item.id !== id));
      }, 3200);
    };

    // Confetti shower generator
    const triggerConfettiShower = () => {
      const colors = ['#ffffff', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];
      const newParticles = [];
      for (let i = 0; i < 50; i++) {
        newParticles.push({
          id: Date.now() + Math.random() + i,
          left: Math.random() * 100,
          delay: Math.random() * 1.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 6 + Math.random() * 8,
          rotation: Math.random() * 360
        });
      }
      setConfettiList(newParticles);
      setTimeout(() => setConfettiList([]), 4200);
    };

    // Auto-spawn floating reactions while on sign-in overlay
    useEffect(() => {
      if ((!currentUser && !isGuest) || isGateOpen) {
        const authInterval = setInterval(() => {
          spawnAuthReaction();
        }, 500);
        return () => clearInterval(authInterval);
      }
    }, [currentUser, isGuest, isGateOpen]);

    // SSO Project Selection Handler
    const handleSelectSSO = (platformId) => {
      const platObj = (PRODUCTS || []).find(p => p.id === platformId) || PRODUCTS[0];
      setSelectedSSO(platObj);
      setSsoForm({ username: '', password: '' });
    };

    // SSO Credential Submission Handler
    const handleSSOSubmit = (e) => {
      e.preventDefault();
      const username = ssoForm.username.trim() || 'Alex Trader';
      const formattedName = username.startsWith('@') || username.startsWith('$') ? username : `@${username}`;
      const badgeText = `${selectedSSO ? selectedSSO.name : 'Ecosystem'} Verified`;
      
      setCurrentUser({
        id: 'user_' + Date.now(),
        name: formattedName,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        badge: badgeText
      });
      setIsGateOpen(false);
      setIsGuest(false);
      setSelectedSSO(null);
      setSsoForm({ username: '', password: '' });

      // Trigger Celebration Animation (No coin bonus)
      setCelebrationModal({
        name: formattedName,
        badge: badgeText,
        coins: 0,
        platform: selectedSSO ? selectedSSO.name : 'NEU TV'
      });
      triggerConfettiShower();
    };

    // Logout Handler
    const handleLogout = () => {
      setCurrentUser(null);
      setIsGuest(true);
      setIsGateOpen(false);
      setSelectedSSO(null);
      setCelebrationModal(null);
    };

    // Email / Form Auth Submit Handler
    const handleAuthSubmit = (e) => {
      e.preventDefault();
      const name = authForm.name.trim() || (authForm.email ? authForm.email.split('@')[0] : 'Alex Trader');
      const platObj = (PRODUCTS || []).find(p => p.id === authForm.platform) || PRODUCTS[0] || { id: 'worldstreet', name: 'WorldStreet' };
      const badgeText = `${platObj.name} Member`;
      const formattedName = name.startsWith('@') ? name : `@${name}`;
      
      setCurrentUser({
        id: 'user_' + Date.now(),
        name: formattedName,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        badge: badgeText
      });
      setIsGateOpen(false);
      setIsGuest(false);

      // Trigger Celebration Animation (No coin bonus)
      setCelebrationModal({
        name: formattedName,
        badge: badgeText,
        coins: 0,
        platform: 'NEU TV'
      });
      triggerConfettiShower();
    };

    // Spawn flying emoji
    const spawnHeart = (customEmoji) => {
      const emoji = customEmoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const id = Date.now() + Math.random();
      const rightOffset = 30 + Math.random() * 50;
      
      setFlyingHearts(prev => [...prev.slice(-15), { id, emoji, rightOffset }]);
      
      setTimeout(() => {
        setFlyingHearts(prev => prev.filter(h => h.id !== id));
      }, 2200);
    };

    // Handle Live Gifts
    const handleSendGift = (gift) => {
      requireAuth('send live gifts', () => {
        if (coinBalance < gift.cost) {
          showToast(`Insufficient balance! You need ${gift.cost} Coins for ${gift.name}.`);
          return;
        }

        setCoinBalance(prev => prev - gift.cost);

        setActiveGiftBanner({
          sender: currentUser ? currentUser.name : 'NEU Viewer',
          giftName: gift.name,
          emoji: gift.emoji || '🎁',
          cost: gift.cost
        });
        setTimeout(() => setActiveGiftBanner(null), 3500);

        for (let i = 0; i < 10; i++) {
          setTimeout(() => spawnHeart(gift.emoji || '🎁'), i * 100);
        }

        setIsGiftModalOpen(false);
        showToast(`Sent ${gift.name} ${gift.emoji || '🎁'}! 🎉`);
      });
    };

    // Handle Comment Submission in Live Stream
    const handleSendLiveComment = (e) => {
      e.preventDefault();
      if (!chatInputText.trim()) return;

      requireAuth('comment on live stream', () => {
        const newComment = {
          uniqueId: Date.now(),
          author: currentUser.name,
          avatar: currentUser.avatar,
          text: chatInputText.trim()
        };
        setActiveLiveComments(prev => [newComment, ...prev.slice(0, 2)]);
        setChatInputText('');
      });
    };

    // Send Right Sidebar Live Community Message
    const handleSendRightChatMessage = (e) => {
      e.preventDefault();
      if (!rightChatInputText.trim() || !activeChannelObj) return;

      requireAuth('chat in community room', () => {
        const chanId = activeChannelObj.id;
        const newMsg = {
          id: Date.now(),
          author: currentUser.name,
          role: currentUser.badge,
          avatar: currentUser.avatar,
          timestamp: 'Just now',
          text: rightChatInputText.trim(),
          reactions: { '❤️': 1 }
        };

        setCommunityMessages(prev => ({
          ...prev,
          [chanId]: [...(prev[chanId] || []), newMsg]
        }));

        setRightChatInputText('');
      });
    };

    // Join / Leave Community Room Handlers (First-time user onboarding)
    const handleJoinCommunity = (serverId) => {
      const hub = PRODUCT_COMMUNITY_HUBS[serverId] || { name: 'Community' };
      requireAuth(`join the ${hub.name} community`, () => {
        setJoinedCommunities(prev => ({ ...prev, [serverId]: true }));
        for (let i = 0; i < 8; i++) {
          setTimeout(() => spawnHeart('🎉'), i * 120);
        }
      });
    };

    const handleLeaveCommunity = (serverId) => {
      setJoinedCommunities(prev => ({ ...prev, [serverId]: false }));
    };

    // Trigger Burst of Hearts
    const handleToggleTvLike = () => {
      requireAuth('like live stream', () => {
        if (isTvLiked) {
          setTvLikes(prev => prev - 1);
          setIsTvLiked(false);
        } else {
          setTvLikes(prev => prev + 1);
          setIsTvLiked(true);
          for (let i = 0; i < 6; i++) {
            setTimeout(() => spawnHeart('❤️'), i * 150);
          }
        }
      });
    };

    // Scroll Row Helper
    const handleScrollRow = (rowId, direction) => {
      const el = document.getElementById(rowId);
      if (el) {
        const amount = direction === 'left' ? -450 : 450;
        el.scrollBy({ left: amount, behavior: 'smooth' });
      }
    };

    // Filter Video Rows based on Active Product Selection
    const filteredRows = useMemo(() => {
      return mediaRows.map(row => {
        let items = [...(row.items || [])];
        if (activeProductId !== 'all') {
          items = items.filter(item => item.productId === activeProductId);
        }
        return { ...row, items };
      }).filter(row => row.items.length > 0);
    }, [mediaRows, activeProductId]);

    // Filter Posts based on Active Product Selection, Following, and Search
    const filteredPosts = useMemo(() => {
      let result = [...posts];
      if (activeProductId !== 'all') {
        result = result.filter(p => p.productId === activeProductId);
      }
      if (activeMainTab === 'following') {
        result = result.filter(p => followingUsers[p.handle]);
      }
      if (activeMainTab === 'saved') {
        result = result.filter(p => savedPosts[p.id]);
      }
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        result = result.filter(p => 
          (p.author && p.author.toLowerCase().includes(q)) ||
          (p.content && p.content.toLowerCase().includes(q)) ||
          (p.productName && p.productName.toLowerCase().includes(q)) ||
          (p.categoryTag && p.categoryTag.toLowerCase().includes(q)) ||
          (p.videoTitle && p.videoTitle.toLowerCase().includes(q))
        );
      }
      return result;
    }, [posts, activeProductId, activeMainTab, followingUsers, savedPosts, searchQuery]);

    const handleToggleUpvote = (postId) => {
      requireAuth('upvote posts', () => {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isUpvoted: !p.isUpvoted,
              upvotes: p.isUpvoted ? p.upvotes - 1 : p.upvotes + 1
            };
          }
          return p;
        }));
      });
    };

    const handleAddComment = (postId) => {
      const text = commentInputs[postId];
      if (!text || !text.trim()) return;

      requireAuth('comment on posts', () => {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: [
                ...p.comments,
                { id: 'c_' + Date.now(), author: currentUser ? currentUser.name : 'You', text: text.trim(), timestamp: 'Just now' }
              ]
            };
          }
          return p;
        }));

        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      });
    };

    const handleCreatePostSubmit = (e) => {
      e.preventDefault();
      if (!newPostText.trim()) return;

      requireAuth('publish community posts', () => {
        const prodObj = PRODUCTS.find(p => p.id === newPostProduct) || PRODUCTS[1] || { id: 'tsion', name: 'Tsion' };

        const newPost = {
          id: 'post_' + Date.now(),
          author: currentUser ? currentUser.name : 'You',
          handle: '@user_me',
          avatar: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          productId: prodObj.id,
          productName: prodObj.name,
          timestamp: 'Just now',
          content: newPostText,
          mediaUrl: newPostMedia.trim() || null,
          upvotes: 1,
          isUpvoted: true,
          comments: []
        };

        setPosts([newPost, ...posts]);
        setNewPostText('');
        setNewPostMedia('');
        setIsCreatePostOpen(false);
      });
    };

    return h('div', { className: 'h-screen w-screen overflow-hidden flex bg-black text-white relative selection:bg-white selection:text-black font-sans' },

      // ═══════════════════════════════════════════════════════════
      // FULL GLASS EFFECT SIGN IN & SIGN UP MODAL WITH POPPING GIFTS & CELEBRATION PARTICLES
      // ═══════════════════════════════════════════════════════════
      ((!currentUser && !isGuest) || isGateOpen) && h('div', {
        onClick: (e) => {
          if (e.target === e.currentTarget) {
            const clickX = (e.clientX / window.innerWidth) * 100;
            spawnAuthReaction(clickX);
            spawnAuthReaction(clickX + 4);
          }
        },
        className: 'fixed inset-0 z-50 bg-black/75 backdrop-blur-2xl flex items-center justify-center p-3 md:p-8 overflow-y-auto no-scrollbar animate-fadeIn select-none'
      },
        // Floating Popping Emoji Reactions & Gifts on Signin Screen
        authPoppingEmojis.map(item => h('div', {
          key: item.id,
          style: { left: `${item.leftPos}%`, fontSize: `${item.size}rem` },
          className: 'auth-popping-emoji'
        }, item.icon)),

        h('div', {
          className: 'relative z-10 w-full max-w-6xl min-h-[640px] md:min-h-[720px] bg-neutral-950/95 backdrop-blur-3xl rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95)] border border-white/20 flex flex-col md:flex-row text-white my-auto animate-scaleUp'
        },
          
          // LEFT COLUMN: LIVE TSION TV AUTOPLAY STREAM (EXPANDED CINEMATIC SUITE)
          h('div', { className: 'md:w-1/2 relative bg-black min-h-[360px] md:min-h-[720px] flex flex-col justify-between p-6 md:p-12 text-white overflow-hidden group' },
            
            // Autoplay YouTube Live Stream Player Background
            h('div', { className: 'absolute inset-0 pointer-events-none overflow-hidden' },
              h('iframe', {
                src: `https://www.youtube-nocookie.com/embed/${centralTv.youtubeId || 'A4vbtSapWLM'}?autoplay=1&mute=1&playsinline=1&controls=0&loop=1&playlist=${centralTv.youtubeId || 'A4vbtSapWLM'}&modestbranding=1&enablejsapi=1&rel=0`,
                title: 'Live NEU TV Broadcast',
                allow: 'autoplay; encrypted-media; fullscreen',
                className: 'w-full h-full object-cover scale-[1.38] opacity-80 group-hover:scale-150 transition duration-1000'
              })
            ),

            // Cinematic Dark Glass Overlays
            h('div', { className: 'absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/35 pointer-events-none' }),
            h('div', { className: 'absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent pointer-events-none' }),

            // Top Row: Brand Badge & Live Broadcast Status + Guest Preview Button
            h('div', { className: 'relative z-10 flex items-center justify-between' },
              h('div', { className: 'flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/20 shadow-xl' },
                h('div', { className: 'w-2.5 h-2.5 rounded-full bg-red-500 animate-live shadow-lg' }),
                h('span', { className: 'font-black text-xs tracking-wider text-white' }, 'NEU TV'),
                h('span', { className: 'text-white/40 text-xs' }, '|'),
                h('span', { className: 'text-[11px] text-white/90 font-extrabold uppercase tracking-wider' }, `${(centralTv.viewers || 34200).toLocaleString()} ON AIR`)
              ),
              h('button', {
                type: 'button',
                onClick: () => { setIsGuest(true); setIsGateOpen(false); },
                title: 'Dismiss overlay to explore stream in read-only guest mode',
                className: 'px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold transition border border-white/25 flex items-center gap-2 shadow-xl hover:scale-105'
              },
                h('i', { 'data-lucide': 'eye', className: 'w-3.5 h-3.5 text-white' }),
                'Explore as Guest ↗'
              )
            ),

            // Bottom Welcoming & Persuasive Headline (Central Streaming & Networking Focus)
            h('div', { className: 'relative z-10 space-y-3.5' },
              h('div', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-mono font-bold tracking-wider' },
                h('i', { 'data-lucide': 'radio', className: 'w-3.5 h-3.5 fill-current text-white' }),
                h('span', null, 'The Central Media & Streaming Network')
              ),
              h('h3', { className: 'text-2xl md:text-3xl font-black text-white tracking-tight leading-tight' },
                'Where The World Connects, Streams & Broadcasts Live.'
              ),
              h('p', { className: 'text-xs md:text-sm text-white/80 leading-relaxed font-medium max-w-md' },
                'Step inside the central network. Stream premier 24/7 live shows, connect with visionary creators and industry leaders, and engage in real-time community hubs.'
              ),
              h('div', { className: 'flex flex-wrap items-center gap-3 pt-1 text-xs text-white/80 font-bold' },
                h('span', { className: 'text-white flex items-center gap-1.5' },
                  h('i', { 'data-lucide': 'users', className: 'w-3.5 h-3.5 fill-current text-white' }),
                  'Global Creator Network'
                ),
                h('span', null, '•'),
                h('span', { className: 'text-white flex items-center gap-1.5' },
                  h('i', { 'data-lucide': 'tv', className: 'w-3.5 h-3.5 fill-current text-white' }),
                  '24/7 Central Broadcasts'
                ),
                h('span', null, '•'),
                h('span', { className: 'text-white flex items-center gap-1.5' },
                  h('i', { 'data-lucide': 'message-square', className: 'w-3.5 h-3.5 fill-current text-white' }),
                  'Real-Time Live Hubs'
                )
              )
            )
          ),

          // RIGHT COLUMN: EXPANDED TSION DARK GLASS FORM & SSO
          h('div', { className: 'md:w-1/2 p-8 md:p-12 flex flex-col justify-between space-y-6 bg-neutral-900/70 backdrop-blur-2xl text-white border-t md:border-t-0 md:border-l border-white/10 overflow-y-auto no-scrollbar' },
            
            selectedSSO ? h('div', { className: 'space-y-5 animate-fadeIn text-left my-auto' },
              // Back Button & Security Status
              h('div', { className: 'flex items-center justify-between pb-1' },
                h('button', {
                  type: 'button',
                  onClick: () => setSelectedSSO(null),
                  className: 'text-xs text-white/70 hover:text-white flex items-center gap-1.5 font-bold transition group'
                },
                  h('i', { 'data-lucide': 'arrow-left', className: 'w-4 h-4 group-hover:-translate-x-1 transition' }),
                  'Back to all options'
                ),
                h('div', { className: 'flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-[10px] text-white/70 font-semibold' },
                  h('i', { 'data-lucide': 'shield-check', className: 'w-3.5 h-3.5 fill-current text-white' }),
                  'NEU SSO Gateway'
                )
              ),

              // Selected Platform Banner
              h('div', { className: 'p-4 rounded-2xl bg-white/5 border border-white/15 flex items-center gap-3.5' },
                h('div', { className: 'w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg flex-shrink-0' },
                  h('i', {
                    'data-lucide': selectedSSO.id === 'worldstreet' ? 'trending-up' : selectedSSO.id === 'market' ? 'shopping-bag' : selectedSSO.id === 'linkpay' ? 'credit-card' : selectedSSO.id === 'ark' ? 'shield-check' : 'car',
                    className: 'w-6 h-6 fill-current'
                  })
                ),
                h('div', null,
                  h('div', { className: 'flex items-center gap-2' },
                    h('h3', { className: 'font-black text-base text-white tracking-tight' }, `Sign in with ${selectedSSO.name}`),
                    h('span', { className: 'px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-mono text-white/80 font-bold' }, 'SSO')
                  ),
                  h('p', { className: 'text-xs text-white/60 font-medium mt-0.5' }, `Enter your registered ${selectedSSO.name} credentials to sign in.`)
                )
              ),

              // SSO Credential Form
              h('form', { onSubmit: handleSSOSubmit, className: 'space-y-4' },
                h('div', { className: 'space-y-1.5' },
                  h('label', { className: 'text-xs font-bold text-white/80 flex items-center justify-between' },
                    h('span', null, selectedSSO.id === 'market' ? 'mARKet Username / Merchant Handle*' : selectedSSO.id === 'worldstreet' ? 'WorldStreet Trader Handle*' : selectedSSO.id === 'linkpay' ? 'LinkPay Cashtag / Email*' : selectedSSO.id === 'ark' ? 'ARK Vault ID / Username*' : 'Tsion Cars Member ID*'),
                    h('span', { className: 'text-[10px] text-white/40 font-normal' }, 'Ecosystem ID')
                  ),
                  h('input', {
                    type: 'text',
                    placeholder: selectedSSO.id === 'market' ? '@merchant_sam' : selectedSSO.id === 'worldstreet' ? '@wallstreet_pro' : selectedSSO.id === 'linkpay' ? '$alexlinkpay' : selectedSSO.id === 'ark' ? '@ark_yield' : '@tsion_driver',
                    value: ssoForm.username,
                    onChange: e => setSsoForm({ ...ssoForm, username: e.target.value }),
                    className: 'w-full px-4 py-3 rounded-2xl border border-white/15 focus:border-white/50 bg-white/5 focus:bg-white/10 text-xs text-white placeholder-white/40 outline-none transition',
                    required: true
                  })
                ),

                h('div', { className: 'space-y-1.5' },
                  h('label', { className: 'text-xs font-bold text-white/80 flex items-center justify-between' },
                    h('span', null, `${selectedSSO.name} Password or Security PIN*`),
                    h('span', { className: 'text-[10px] text-white/40 font-normal' }, 'Encrypted')
                  ),
                  h('input', {
                    type: 'password',
                    placeholder: '••••••••••••',
                    value: ssoForm.password,
                    onChange: e => setSsoForm({ ...ssoForm, password: e.target.value }),
                    className: 'w-full px-4 py-3 rounded-2xl border border-white/15 focus:border-white/50 bg-white/5 focus:bg-white/10 text-xs text-white placeholder-white/40 outline-none transition',
                    required: true
                  })
                ),

                // Access Permissions Granted Box
                h('div', { className: 'p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 text-[11px] text-white/70' },
                  h('div', { className: 'flex items-center gap-2' },
                    h('i', { 'data-lucide': 'check-circle-2', className: 'w-3.5 h-3.5 fill-current text-[#00F6A7] flex-shrink-0' }),
                    h('span', null, `Sync ${selectedSSO.name} verified status & badge`)
                  ),
                  h('div', { className: 'flex items-center gap-2' },
                    h('i', { 'data-lucide': 'check-circle-2', className: 'w-3.5 h-3.5 fill-current text-[#00F6A7] flex-shrink-0' }),
                    h('span', null, 'Full HD live broadcast streaming & interactive chat')
                  ),
                  h('div', { className: 'flex items-center gap-2' },
                    h('i', { 'data-lucide': 'check-circle-2', className: 'w-3.5 h-3.5 fill-current text-[#00F6A7] flex-shrink-0' }),
                    h('span', null, `Instant access to official #${selectedSSO.id} community hub`)
                  )
                ),

                // Submit Button
                h('button', {
                  type: 'submit',
                  className: 'w-full py-3.5 rounded-full bg-white hover:bg-white/90 text-black font-black text-xs md:text-sm transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-98 mt-2'
                },
                  h('span', null, `Authorize & Sign In with ${selectedSSO.name}`),
                  h('i', { 'data-lucide': 'arrow-right', className: 'w-4 h-4 stroke-[3]' })
                )
              )
            ) : h('div', { className: 'space-y-6 flex flex-col justify-between h-full' },
              
              // Headline & Subtitle
              h('div', { className: 'space-y-1.5 text-left' },
                h('h2', { className: 'text-2xl md:text-3xl font-black text-white tracking-tight font-sans' },
                  authMode === 'signup' ? "Create NEU Passport" : "Welcome Back to NEU TV"
                ),
                h('p', { className: 'text-xs md:text-sm text-white/60 font-medium' },
                  authMode === 'signup' ? 'One unified login for all 5 New Economy platforms.' : 'Sign in to access 24/7 live broadcasts, community hubs, and creator feeds.'
                )
              ),

              // 1-CLICK ECOSYSTEM SSO PLATFORMS WITH OFFICIAL PRODUCT LOGOS
              h('div', { className: 'space-y-2.5' },
                h('div', { className: 'flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-white/50 px-1' },
                  h('div', { className: 'flex items-center gap-1.5' },
                    h('i', { 'data-lucide': 'zap', className: 'w-3 h-3 fill-current text-[#00F6A7]' }),
                    h('span', null, 'Sign In with Ecosystem Account (SSO)')
                  ),
                  h('span', { className: 'text-[10px] text-white/80 font-bold' }, 'Instant Login')
                ),
                h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2' },
                  PRODUCTS.map(prod => {
                    return h('button', {
                      key: prod.id,
                      type: 'button',
                      onClick: () => handleSelectSSO(prod.id),
                      className: 'p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/15 hover:border-[#00F6A7]/40 text-left transition flex items-center gap-2.5 group shadow-sm'
                    },
                      h('div', { className: 'w-8 h-8 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center p-1.5 flex-shrink-0 group-hover:scale-105 transition overflow-hidden shadow-inner' },
                        prod.logo ? h('img', { src: prod.logo, alt: prod.name, className: 'w-full h-full object-contain' }) : h('span', { className: 'font-black text-xs text-white' }, prod.name.slice(0, 2))
                      ),
                      h('div', { className: 'min-w-0' },
                        h('div', { className: 'font-bold text-xs text-white group-hover:text-white transition truncate' }, prod.name),
                        h('div', { className: 'text-[9px] text-white/40 truncate' }, prod.tag || 'SSO Gateway')
                      )
                    );
                  })
                )
              ),

              // Divider
              h('div', { className: 'relative flex items-center justify-center py-0.5' },
                h('div', { className: 'border-t border-white/10 w-full' }),
                h('span', { className: 'bg-neutral-900 px-3 text-[10px] text-white/40 font-bold uppercase absolute' }, 'or with email')
              ),

              // Email & Password Form
              h('form', { onSubmit: handleAuthSubmit, className: 'space-y-3.5' },
                
                authMode === 'signup' && h('div', { className: 'space-y-1.5 text-left' },
                  h('label', { className: 'text-xs font-bold text-white/70' }, 'Full Name / Trader Alias*'),
                  h('input', {
                    type: 'text',
                    placeholder: 'e.g. Alex Trader',
                    value: authForm.name,
                    onChange: e => setAuthForm({ ...authForm, name: e.target.value }),
                    className: 'w-full px-4 py-3 rounded-2xl border border-white/15 focus:border-white/40 bg-white/5 focus:bg-white/10 text-xs text-white placeholder-white/40 outline-none transition',
                    required: authMode === 'signup'
                  })
                ),

                h('div', { className: 'space-y-1.5 text-left' },
                  h('label', { className: 'text-xs font-bold text-white/70' }, 'Email Address*'),
                  h('input', {
                    type: 'email',
                    placeholder: 'alex@neweconomy.io',
                    value: authForm.email,
                    onChange: e => setAuthForm({ ...authForm, email: e.target.value }),
                    className: 'w-full px-4 py-3 rounded-2xl border border-white/15 focus:border-white/40 bg-white/5 focus:bg-white/10 text-xs text-white placeholder-white/40 outline-none transition',
                    required: true
                  })
                ),

                h('div', { className: 'space-y-1.5 text-left' },
                  h('label', { className: 'text-xs font-bold text-white/70' }, 'Password*'),
                  h('input', {
                    type: 'password',
                    placeholder: '••••••••••••',
                    value: authForm.password,
                    onChange: e => setAuthForm({ ...authForm, password: e.target.value }),
                    className: 'w-full px-4 py-3 rounded-2xl border border-white/15 focus:border-white/40 bg-white/5 focus:bg-white/10 text-xs text-white placeholder-white/40 outline-none transition',
                    required: true
                  })
                ),

                // Agreement Checkbox
                h('label', { className: 'flex items-center gap-2.5 text-xs text-white/60 cursor-pointer select-none' },
                  h('input', {
                    type: 'checkbox',
                    defaultChecked: true,
                    className: 'w-4 h-4 rounded text-white accent-white cursor-pointer'
                  }),
                  h('span', { className: 'text-xs leading-snug' }, 'I agree to the Terms of Service & Privacy Policy.')
                ),

                // Primary Submit Button with Filled Icon
                h('button', {
                  type: 'submit',
                  className: 'w-full py-3.5 rounded-full bg-white hover:bg-white/90 text-black font-black text-xs md:text-sm transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-98 mt-1'
                },
                  h('span', null,
                    authMode === 'signup' ? 'Create NEU Passport' : 'Sign In to NEU TV'
                  ),
                  h('i', { 'data-lucide': 'arrow-right', className: 'w-4 h-4 stroke-[3]' })
                )
              ),

              // Footer Switch Link
              h('div', { className: 'text-center pt-1 text-xs text-white/50' },
                authMode === 'signup' ? h('span', null,
                  'Already have an account? ',
                  h('button', {
                    type: 'button',
                    onClick: () => setAuthMode('signin'),
                    className: 'text-white font-bold underline hover:text-white/80 ml-1'
                  }, 'Sign In')
                ) : h('span', null,
                  "Don't have an account? ",
                  h('button', {
                    type: 'button',
                    onClick: () => setAuthMode('signup'),
                    className: 'text-white font-bold underline hover:text-white/80 ml-1'
                  }, 'Create Passport')
                )
              )
            )
          )
        )
      ),

      // ═══════════════════════════════════════════════════════════
      // CELEBRATION MODAL (FULL PARTICLES & CONFETTI)
      // ═══════════════════════════════════════════════════════════
      celebrationModal && h('div', { className: 'fixed inset-0 z-[100] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn select-none' },
        // Raining Confetti Stream
        confettiList.map(item => h('div', {
          key: item.id,
          style: {
            left: `${item.left}%`,
            backgroundColor: item.color,
            width: `${item.size}px`,
            height: `${item.size * 1.6}px`,
            animationDelay: `${item.delay}s`,
            transform: `rotate(${item.rotation}deg)`
          },
          className: 'confetti-particle rounded-xs shadow-lg'
        })),

        h('div', { className: 'relative z-10 w-full max-w-lg bg-neutral-950 border border-white/20 rounded-3xl p-8 md:p-10 text-center text-white space-y-6 animate-scaleUp' },
          // Clean Hologram Badge
          h('div', { className: 'relative mx-auto w-20 h-20 rounded-full bg-white/10 border border-white/25 flex items-center justify-center' },
            h('div', { className: 'w-14 h-14 rounded-full bg-white text-black flex items-center justify-center font-black text-xl' },
              h('i', { 'data-lucide': 'sparkles', className: 'w-7 h-7 fill-current text-black' })
            ),
            h('div', { className: 'absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#00F6A7] text-black flex items-center justify-center font-bold text-xs border-2 border-black' }, '✓')
          ),

          // Heading & Passport Activation Info
          h('div', { className: 'space-y-1.5' },
            h('div', { className: 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-white uppercase tracking-wider' },
              h('i', { 'data-lucide': 'shield-check', className: 'w-3.5 h-3.5 fill-current text-[#00F6A7]' }),
              'Passport Verified & Active'
            ),
            h('h2', { className: 'text-2xl md:text-3xl font-black tracking-tight text-white' }, `Welcome, ${celebrationModal.name}!`),
            h('p', { className: 'text-xs md:text-sm text-white/60 font-medium max-w-sm mx-auto' },
              `Your Ecosystem identity is verified. You now have full access to NEU TV broadcasts and official hubs.`
            )
          ),

          // Verified Perks Box (No bonus claims)
          h('div', { className: 'p-4 rounded-2xl bg-white/5 border border-white/15 space-y-3 text-left' },
            h('div', { className: 'flex items-center justify-between' },
              h('span', { className: 'text-xs text-white/60 font-medium' }, 'Verified Role:'),
              h('span', { className: 'text-xs font-extrabold text-emerald-400' }, celebrationModal.badge)
            ),
            h('div', { className: 'flex items-center justify-between' },
              h('span', { className: 'text-xs text-white/60 font-medium' }, 'Central Stream Status:'),
              h('span', { className: 'text-xs font-bold text-white' }, 'Full HD & Interactive Chat Unlocked')
            ),
            h('div', { className: 'flex items-center justify-between' },
              h('span', { className: 'text-xs text-white/60 font-medium' }, 'Ecosystem Access:'),
              h('span', { className: 'text-xs font-mono text-[#00F6A7] font-bold' }, 'Active & Authenticated')
            )
          ),

          // Primary Enter Button
          h('button', {
            type: 'button',
            onClick: () => setCelebrationModal(null),
            className: 'w-full py-4 rounded-full bg-white hover:bg-white/90 text-black font-black text-sm transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-98'
          },
            h('span', null, 'Enter Central Broadcast & Live Stage'),
            h('i', { 'data-lucide': 'arrow-right', className: 'w-4 h-4 stroke-[3]' })
          )
        )
      ),

      // Ambient Glows
      h('div', { className: 'ambient-glow -top-32 -left-32 opacity-40' }),
      h('div', { className: 'ambient-glow top-96 -right-32 opacity-25' }),

      // -------------------------------------------------------------
      // 1. LEFT SIDEBAR: PRODUCTS & DIFFERENT COMMUNITY ROOMS (PRD ALIGNED)
      // -------------------------------------------------------------
      h('aside', { className: 'w-64 md:w-72 h-screen flex-shrink-0 flex flex-col justify-between p-6 border-r border-white/10 bg-[#0B1220]/95 backdrop-blur-2xl z-40 overflow-y-auto no-scrollbar shadow-2xl sticky top-0 space-y-6' },
        h('div', { className: 'space-y-6' },
          
          // Official NEU TV Brand Header (from Brand Guide)
          h('div', { 
            className: 'flex items-center gap-3.5 cursor-pointer py-1 group select-none',
            onClick: () => { setActiveProductId('all'); setActiveMainTab('tv'); }
          },
            // Glowing N App Icon Badge
            h('div', { className: 'w-11 h-11 rounded-2xl bg-[#111B33] border border-[#00F6A7]/40 shadow-[0_0_20px_rgba(0,246,167,0.2)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition duration-300' },
              h('span', { className: 'text-xl font-black italic bg-gradient-to-r from-[#00F6A7] via-[#00C8FF] to-[#4D6BFF] bg-clip-text text-transparent' }, 'N')
            ),
            h('div', { className: 'min-w-0' },
              h('div', { className: 'flex items-center gap-1 leading-none' },
                h('span', { className: 'font-black text-2xl tracking-tighter italic bg-gradient-to-r from-[#00F6A7] via-[#00C8FF] to-[#4D6BFF] bg-clip-text text-transparent group-hover:brightness-110 transition' }, 'NEU'),
                h('span', { className: 'text-[#00C8FF] text-[11px] font-black tracking-widest -mt-1.5' }, 'TV'),
                h('span', { className: 'w-2 h-2 rounded-full bg-[#00F6A7] animate-pulse ml-1 shadow-[0_0_8px_#00F6A7]' })
              ),
              h('p', { className: 'text-[9px] font-mono tracking-widest text-[#00C8FF]/80 uppercase mt-1 font-bold truncate' }, 'THE NEW ECONOMY, ON SCREEN.')
            )
          ),

          // Balance Display Badge with Cyan/Gold Touch
          h('div', { className: 'p-3.5 rounded-2xl bg-[#111B33]/80 border border-white/10 flex items-center justify-between shadow-lg' },
            h('div', { className: 'flex items-center gap-2.5' },
              h('div', { className: 'w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400' },
                h('i', { 'data-lucide': 'coins', className: 'w-4.5 h-4.5' })
              ),
              h('div', null,
                h('div', { className: 'text-[9px] text-white/50 font-extrabold uppercase tracking-wider' }, 'KashCoin Balance'),
                h('div', { className: 'text-xs md:text-sm font-black text-white' }, `${coinBalance.toLocaleString()} KASH`)
              )
            ),
            h('button', {
              onClick: () => requireAuth('send gifts', () => setIsGiftModalOpen(true)),
              className: 'px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-[11px] font-black transition shadow-md flex items-center gap-1.5 transform active:scale-95'
            },
              h('span', { className: 'text-sm' }, '🎁'),
              h('span', null, 'Gift')
            )
          ),

          // Primary Navigation Menu (Central TV & Feed Focus)
          h('nav', { className: 'space-y-1.5' },
            h('div', { className: 'text-[10px] font-extrabold tracking-widest text-white/40 uppercase mb-2 px-3' }, 'NAVIGATION'),

            h('button', {
              onClick: () => { setActiveMainTab('tv'); setActiveProductId('all'); },
              className: `w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition duration-200 ${activeMainTab === 'tv' ? 'bg-gradient-to-r from-[#00F6A7]/20 to-[#00C8FF]/20 text-[#00F6A7] border border-[#00F6A7]/40 shadow-[0_0_20px_rgba(0,246,167,0.15)] scale-[1.02]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`
            },
              h('div', { className: 'flex items-center gap-3' },
                h('i', { 'data-lucide': 'tv', className: 'w-4.5 h-4.5 fill-current text-[#00F6A7]' }),
                h('span', null, 'NEU TV Live')
              ),
              h('span', { className: `text-[9px] px-2 py-0.5 rounded-full font-extrabold ${activeMainTab === 'tv' ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400'}` }, 'ON AIR')
            ),

            h('button', {
              onClick: () => { setActiveMainTab('foryou'); setActiveProductId('all'); },
              className: `w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition duration-200 ${activeMainTab === 'foryou' ? 'bg-gradient-to-r from-[#00F6A7]/20 to-[#00C8FF]/20 text-[#00F6A7] border border-[#00F6A7]/40 shadow-[0_0_20px_rgba(0,246,167,0.15)] scale-[1.02]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`
            },
              h('div', { className: 'flex items-center gap-3' },
                h('i', { 'data-lucide': 'sparkles', className: 'w-4.5 h-4.5 fill-current text-amber-400' }),
                h('span', null, 'For You')
              ),
              h('span', { className: 'text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400' }, 'Hot')
            ),

            h('button', {
              onClick: () => { setActiveMainTab('following'); setActiveProductId('all'); },
              className: `w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition duration-200 ${activeMainTab === 'following' ? 'bg-gradient-to-r from-[#00F6A7]/20 to-[#00C8FF]/20 text-[#00F6A7] border border-[#00F6A7]/40 shadow-[0_0_20px_rgba(0,246,167,0.15)] scale-[1.02]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`
            },
              h('div', { className: 'flex items-center gap-3' },
                h('i', { 'data-lucide': 'users', className: 'w-4.5 h-4.5 text-[#00C8FF]' }),
                h('span', null, 'Following')
              )
            ),

            h('button', {
              onClick: () => { setActiveMainTab('saved'); setActiveProductId('all'); },
              className: `w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition duration-200 ${activeMainTab === 'saved' ? 'bg-gradient-to-r from-[#00F6A7]/20 to-[#00C8FF]/20 text-[#00F6A7] border border-[#00F6A7]/40 shadow-[0_0_20px_rgba(0,246,167,0.15)] scale-[1.02]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`
            },
              h('div', { className: 'flex items-center gap-3' },
                h('i', { 'data-lucide': 'bookmark', className: 'w-4.5 h-4.5 text-[#4D6BFF]' }),
                h('span', null, 'Saved Videos')
              )
            )
          ),

          // PRODUCTS & COMMUNITY HUBS (LEFT SIDEBAR)
          h('div', { className: 'space-y-3 pt-4 border-t border-white/10' },
            h('div', { className: 'flex items-center justify-between px-2' },
              h('span', { className: 'text-[10px] font-extrabold tracking-widest text-white/40 uppercase flex items-center gap-1.5' },
                h('i', { 'data-lucide': 'users', className: 'w-3.5 h-3.5 text-white/40' }),
                'COMMUNITIES & SITES'
              ),
              activeProductId !== 'all' && h('button', {
                onClick: () => { setActiveProductId('all'); setActiveCommunityServerId('tsion'); },
                className: 'text-[10px] text-white/60 hover:text-white underline font-semibold'
              }, 'All Feeds')
            ),

            // Products & Communities Directory with direct Official Site links
            h('div', { className: 'space-y-1.5' },
              PRODUCTS.map(prod => {
                const isActive = activeProductId === prod.id || activeCommunityServerId === prod.id;
                return h('div', { key: prod.id, className: 'flex items-center gap-1.5' },
                  
                  // Product & Community Selection Button
                  h('button', {
                    onClick: () => {
                      setActiveProductId(prod.id);
                      setActiveCommunityServerId(prod.id);
                      const hub = PRODUCT_COMMUNITY_HUBS[prod.id];
                      if (hub && hub.channels && hub.channels[0]) {
                        setActiveCommunityChannelId(hub.channels[0].id);
                      }
                    },
                    className: `flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between shadow-sm ${isActive ? 'bg-white text-black font-extrabold shadow-md scale-[1.02]' : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/15 hover:text-white'}`
                  },
                    h('div', { className: 'flex items-center gap-2.5 truncate' },
                      prod.logo ? h('div', { className: `w-5 h-5 rounded-md ${isActive ? 'bg-black/10' : 'bg-white/10'} p-0.5 flex items-center justify-center flex-shrink-0` },
                        h('img', { src: prod.logo, alt: prod.name, className: 'w-full h-full object-contain' })
                      ) : h('span', { className: `w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-black' : 'bg-emerald-400'}` }),
                      h('span', { className: 'truncate' }, prod.name)
                    ),
                    prod.badge && h('span', { className: `text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-black text-white' : 'bg-white/10 text-white/60'}` }, prod.badge)
                  ),

                  // Direct Official Website Link
                  prod.officialUrl && h('a', {
                    href: prod.officialUrl,
                    target: '_blank',
                    rel: 'noreferrer',
                    title: `Visit ${prod.name} Official Website`,
                    className: 'px-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/20 text-white text-[10px] font-bold border border-white/10 transition flex items-center justify-center flex-shrink-0'
                  }, 'Site ↗')
                );
              })
            )
          )
        ),

        // User SSO Bottom Card
        h('div', { className: 'pt-4 border-t border-white/10 flex items-center justify-between gap-2' },
          currentUser ? h('div', { className: 'flex items-center justify-between w-full' },
            h('div', { className: 'flex items-center gap-2.5 min-w-0' },
              h('img', { src: currentUser.avatar, alt: currentUser.name, className: 'w-8 h-8 rounded-full object-cover border border-white/30 shadow-md flex-shrink-0' }),
              h('div', { className: 'min-w-0' },
                h('div', { className: 'text-xs font-bold text-white truncate' }, currentUser.name),
                h('div', { className: 'text-[9px] text-emerald-400 font-bold truncate' }, currentUser.badge)
              )
            ),
            h('div', { className: 'flex items-center gap-1.5 flex-shrink-0' },
              h('button', {
                onClick: () => setIsCreatePostOpen(true),
                title: 'Create Post',
                className: 'w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs transition'
              }, '+'),
              h('button', {
                onClick: handleLogout,
                title: 'Log out & return to Sign In screen',
                className: 'w-7 h-7 rounded-full bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 flex items-center justify-center transition border border-white/10'
              }, h('i', { 'data-lucide': 'log-out', className: 'w-3.5 h-3.5' }))
            )
          ) : h('button', {
            onClick: () => { setIsGuest(false); },
            className: 'w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-white/90 transition shadow-lg text-center flex items-center justify-center gap-2'
          },
            h('i', { 'data-lucide': 'log-in', className: 'w-3.5 h-3.5' }),
            'Sign In to NEU TV'
          )
        )
      ),

      // -------------------------------------------------------------
      // 2. MAIN CENTER FEED COLUMN (NEU TV STREAMING & CHANNELS)
      // -------------------------------------------------------------
      h('main', { className: 'flex-1 h-screen overflow-y-auto min-w-0 p-4 md:p-8 space-y-10 border-r border-white/10 no-scrollbar relative' },
        
        // Brand Horizon Light Beam
        h('div', { className: 'neu-horizon-beam' }),

        // Live Toast Action Notification
        toastMessage && h('div', {
          className: 'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-2.5 rounded-full bg-[#111B33] border border-[#00F6A7] text-white font-bold text-xs shadow-2xl animate-bounce flex items-center gap-2'
        },
          h('i', { 'data-lucide': 'check-circle-2', className: 'w-4 h-4 text-[#00F6A7]' }),
          toastMessage
        ),

        // Top Mobile Navigation & Broadcast Search Header
        h('header', { className: 'flex items-center justify-between gap-4 pb-4 border-b border-white/10 relative z-10' },
          
          // Stream & Feed View Switcher Tabs (Restored Navigation)
          h('div', { className: 'flex items-center gap-3 md:gap-5 text-xs font-bold' },
            h('button', {
              onClick: () => { setActiveMainTab('tv'); setActiveProductId('all'); },
              className: `pb-1.5 transition flex items-center gap-1.5 ${activeMainTab === 'tv' ? 'text-[#00F6A7] border-b-2 border-[#00F6A7]' : 'text-white/60 hover:text-white'}`
            },
              h('i', { 'data-lucide': 'tv', className: 'w-4 h-4 fill-current' }),
              h('span', null, 'NEU TV Live')
            ),

            h('button', {
              onClick: () => { setActiveMainTab('foryou'); setActiveProductId('all'); },
              className: `pb-1.5 transition flex items-center gap-1.5 ${activeMainTab === 'foryou' ? 'text-[#00F6A7] border-b-2 border-[#00F6A7]' : 'text-white/60 hover:text-white'}`
            },
              h('i', { 'data-lucide': 'sparkles', className: 'w-4 h-4 text-amber-400' }),
              h('span', null, 'For You Feed')
            ),

            h('button', {
              onClick: () => { setActiveMainTab('following'); setActiveProductId('all'); },
              className: `pb-1.5 transition flex items-center gap-1.5 ${activeMainTab === 'following' ? 'text-[#00F6A7] border-b-2 border-[#00F6A7]' : 'text-white/60 hover:text-white'}`
            },
              h('i', { 'data-lucide': 'users', className: 'w-4 h-4' }),
              h('span', null, 'Following')
            )
          ),

          // Central Search Input
          h('div', { className: 'relative max-w-sm flex-1 hidden md:block' },
            h('i', { 'data-lucide': 'search', className: 'w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40' }),
            h('input', {
              type: 'text',
              placeholder: 'Search NEU TV broadcasts, signals & videos...',
              value: searchQuery,
              onChange: e => setSearchQuery(e.target.value),
              className: 'w-full bg-[#111B33]/70 border border-white/15 rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-white/40 outline-none focus:border-[#00F6A7]/50 focus:bg-[#111B33] transition'
            }),
            searchQuery && h('button', {
              onClick: () => setSearchQuery(''),
              className: 'absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs'
            }, '✕')
          ),

          // Resolution Selector
          h('div', { className: 'flex items-center gap-3 flex-shrink-0' },
            h('select', {
              value: qualityMode,
              onChange: e => setQualityMode(e.target.value),
              className: 'bg-[#111B33] border border-white/20 rounded-full px-3 py-1.5 text-xs text-white outline-none font-bold cursor-pointer focus:border-[#00F6A7]'
            },
              h('option', { value: '1080p', className: 'bg-[#0B1220] text-white' }, '1080p HD Ultra'),
              h('option', { value: 'auto', className: 'bg-[#0B1220] text-white' }, 'Auto (720p)'),
              h('option', { value: 'lowdata', className: 'bg-[#0B1220] text-white' }, 'Low Data (240p)')
            )
          )
        ),

        // HERO VIDEO BROADCAST PLAYER (NEU TV LIVE STAGE)
        h('section', { ref: heroPlayerRef, className: 'relative w-full rounded-3xl border border-white/15 bg-[#0B1220] overflow-hidden shadow-2xl group flex flex-col z-10' },
          
          // DEDICATED TV HEADER CONTROL BAR (ABOVE VIDEO — 100% VISIBLE & NON-OVERLAPPING)
          h('div', { className: 'p-4 md:px-6 md:py-3.5 bg-[#0B1220]/95 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap z-30' },
            // Left: Live Channel Telemetry with NEU TV Gradient Logo
            h('div', { className: 'flex items-center gap-3' },
              h('div', { className: 'flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black' },
                h('span', { className: 'w-2 h-2 rounded-full bg-red-500 animate-live shadow-lg' }),
                h('span', null, 'ON AIR')
              ),
              // Brand Logo Lockup
              h('div', { className: 'flex items-center gap-1 text-white font-extrabold text-sm md:text-base tracking-tight leading-none' },
                h('span', { className: 'font-black italic bg-gradient-to-r from-[#00F6A7] via-[#00C8FF] to-[#4D6BFF] bg-clip-text text-transparent' }, 'NEU'),
                h('span', { className: 'text-[#00C8FF] text-[10px] font-black tracking-widest -mt-1' }, 'TV'),
                h('span', { className: 'text-xs text-white/50 font-normal ml-1 hidden sm:inline' }, 'Broadcast')
              ),
              h('span', { className: 'text-white/30 hidden sm:inline' }, '|'),
              h('span', { className: 'text-xs text-[#00F6A7] font-semibold hidden sm:inline' }, `${(centralTv.viewers || 34200).toLocaleString()} watching live`)
            ),

            // Right: Prominent Audio Mute/Unmute Toggle & Quality Controls
            h('div', { className: 'flex items-center gap-2' },
              h('button', {
                type: 'button',
                onClick: () => setIsMuted(!isMuted),
                className: `px-4 py-1.5 rounded-full text-xs font-black transition flex items-center gap-2 shadow-lg ${isMuted ? 'bg-gradient-to-r from-[#00F6A7] to-[#00C8FF] text-black hover:brightness-110' : 'bg-white/10 text-white border border-white/25 hover:bg-white/20'}`
              },
                h('i', {
                  'data-lucide': isMuted ? 'volume-x' : 'volume-2',
                  className: 'w-4 h-4 fill-current'
                }),
                h('span', null, isMuted ? 'Unmute Audio' : 'Mute Audio')
              ),
              h('div', { className: 'px-2.5 py-1 rounded-full bg-[#111B33] border border-white/15 text-[10px] font-mono text-[#00C8FF] font-bold hidden md:block' }, '1080p HD')
            )
          ),

          h('div', { className: 'relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden' },
            
            // Embedded 24/7 Continuous Live Stream (Speed controls & fast-forwarding disabled for Live TV)
            h('iframe', {
              src: `https://www.youtube-nocookie.com/embed/${centralTv.youtubeId || 'SqBx7QADBes'}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${centralTv.youtubeId || 'SqBx7QADBes'}&controls=0&disablekb=1&modestbranding=1&enablejsapi=1&rel=0&iv_load_policy=3&playsinline=1`,
              title: centralTv.title || 'NEU TV Live Broadcast',
              allow: 'autoplay; fullscreen; picture-in-picture; encrypted-media',
              allowFullScreen: true,
              className: 'w-full h-full object-cover border-0 pointer-events-none scale-[1.02]'
            }),

            // ANIMATED LIVE GIFT ALERT BANNER
            activeGiftBanner && h('div', { className: 'absolute top-16 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-[#111B33] text-white font-black text-xs md:text-sm flex items-center gap-3 shadow-2xl border-2 border-amber-400 animate-bounce' },
              h('div', { className: 'w-9 h-9 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center text-lg shadow-md' },
                activeGiftBanner.emoji || '🎁'
              ),
              h('span', null, `${activeGiftBanner.sender} sent ${activeGiftBanner.giftName}!`),
              h('span', { className: 'px-2 py-0.5 rounded-full bg-white/10 text-amber-400 text-xs font-mono font-bold' }, `${activeGiftBanner.cost} KASH`)
            ),

            // FLYING HEARTS LAYER
            flyingHearts.map(item => h('div', {
              key: item.id,
              className: 'flying-heart',
              style: { right: `${item.rightOffset}px`, bottom: '60px' }
            }, item.emoji)),

            // FLOATING LIVE CHAT COMMENTS STREAM
            h('div', { className: 'absolute left-6 bottom-24 z-30 flex flex-col gap-2 max-w-sm pointer-events-none' },
              activeLiveComments.map(c => h('div', {
                key: c.uniqueId,
                className: 'live-comment-bubble px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs backdrop-blur-md border border-white/20'
              },
                h('img', { src: c.avatar, alt: c.author, className: 'w-5 h-5 rounded-full object-cover border border-white/30' }),
                h('span', { className: 'font-semibold text-white/90' }, c.author),
                h('span', { className: 'text-white/80' }, c.text)
              ))
            ),

            // REACTION BUTTONS & LIVE GIFT TRIGGER
            h('div', { className: 'absolute right-4 bottom-20 z-40 flex flex-col items-center gap-3' },
              h('button', {
                onClick: () => requireAuth('send live gifts', () => setIsGiftModalOpen(true)),
                title: 'Send Live KashCoin Gift',
                className: 'w-12 h-12 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black text-2xl flex items-center justify-center transition hover:scale-110 active:scale-125 shadow-2xl border-2 border-white/50'
              }, '🎁'),

              h('button', {
                onClick: handleToggleTvLike,
                className: `w-11 h-11 rounded-full border border-white/20 flex flex-col items-center justify-center backdrop-blur-md transition shadow-xl ${isTvLiked ? 'bg-rose-600 text-white border-rose-400 scale-110' : 'bg-black/70 text-white hover:bg-black/90'}`
              },
                h('i', { 'data-lucide': 'heart', className: `w-4 h-4 ${isTvLiked ? 'fill-white' : ''}` }),
                h('span', { className: 'text-[8px] font-bold mt-0.5' }, tvLikes.toLocaleString())
              ),

              h('button', {
                onClick: () => requireAuth('react', () => spawnHeart('🔥')),
                className: 'w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xl flex items-center justify-center hover:bg-black/90 transition active:scale-125 shadow-xl text-amber-400'
              },
                h('i', { 'data-lucide': 'flame', className: 'w-5 h-5 fill-current' })
              )
            ),

            // Bottom Details Banner & Live Stream Comment Input Bar
            h('div', { className: 'absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-t from-[#060A12] via-[#060A12]/90 to-transparent flex flex-col md:flex-row md:items-end justify-between gap-4 pointer-events-auto' },
              h('div', { className: 'max-w-xl space-y-1.5' },
                // Tagline & Brand Badge Line
                h('div', { className: 'flex items-center gap-2 flex-wrap' },
                  h('span', { className: 'text-[9px] font-mono font-black tracking-widest text-[#00F6A7] uppercase bg-[#00F6A7]/10 px-2.5 py-0.5 rounded-full border border-[#00F6A7]/30' }, 'THE NEW ECONOMY, ON SCREEN.'),
                  h('span', { className: 'text-[9px] text-white/50 font-bold uppercase tracking-wider' }, 'INNOVATIVE • BOLD • TRUSTED • INSPIRING')
                ),
                h('h1', { className: 'text-lg md:text-xl font-black tracking-tight text-white leading-snug' }, centralTv.title),
                h('p', { className: 'text-xs text-white/70 line-clamp-1' }, centralTv.description)
              ),

              h('form', { onSubmit: handleSendLiveComment, className: 'flex items-center gap-2 w-full md:w-auto' },
                h('input', {
                  type: 'text',
                  placeholder: currentUser ? 'Comment on live stream...' : 'Sign in to comment...',
                  value: chatInputText,
                  onChange: e => setChatInputText(e.target.value),
                  className: 'bg-[#111B33]/80 border border-white/20 rounded-full px-4 py-2 text-xs text-white placeholder-white/50 outline-none focus:border-[#00F6A7]/60 transition min-w-[220px]'
                }),
                h('button', {
                  type: 'submit',
                  className: 'px-4 py-2 rounded-full bg-gradient-to-r from-[#00F6A7] to-[#00C8FF] text-black font-extrabold text-xs hover:brightness-110 transition shadow-md'
                }, 'Send'),
                h('button', {
                  type: 'button',
                  onClick: () => requireAuth('send live gifts', () => setIsGiftModalOpen(true)),
                  className: 'px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-500/20 border border-amber-400/40 text-amber-300 font-extrabold text-xs hover:bg-amber-400/30 transition shadow-md whitespace-nowrap flex items-center gap-1.5'
                },
                  h('span', { className: 'text-sm' }, '🎁'),
                  h('span', null, 'Gift')
                )
              )
            )
          )
        ),

        // ═══════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════
        // CREATOR SPOTLIGHT: VIDEO COLLAGE SLIDESHOW (PURE CSS GPU MARQUEE)
        // ═══════════════════════════════════════════════════════════
        h('section', { className: 'w-full space-y-3 pt-2' },
          
          // Slideshow Header with Carousel Controls (Clean, Minimal)
          h('div', { className: 'flex items-center justify-between px-1' },
            h('div', { className: 'flex items-center gap-2' },
              h('span', { className: 'w-2 h-2 rounded-full bg-[#00F6A7] animate-pulse' }),
              h('h2', { className: 'text-base font-black text-white tracking-tight' },
                'Creator Spotlights'
              )
            ),

            // Left & Right Carousel Slide Buttons
            h('div', { className: 'flex items-center gap-2' },
              h('button', {
                type: 'button',
                onClick: () => {
                  const track = document.getElementById('creator-slideshow-track');
                  if (track) track.scrollBy({ left: -320, behavior: 'smooth' });
                },
                title: 'Previous',
                className: 'w-8 h-8 rounded-full bg-[#111B33] hover:bg-[#1A2644] text-white/80 hover:text-white border border-white/15 flex items-center justify-center transition shadow-md hover:scale-105 active:scale-95'
              },
                h('i', { 'data-lucide': 'chevron-left', className: 'w-4 h-4' })
              ),
              h('button', {
                type: 'button',
                onClick: () => {
                  const track = document.getElementById('creator-slideshow-track');
                  if (track) track.scrollBy({ left: 320, behavior: 'smooth' });
                },
                title: 'Next',
                className: 'w-8 h-8 rounded-full bg-[#111B33] hover:bg-[#1A2644] text-white/80 hover:text-white border border-white/15 flex items-center justify-center transition shadow-md hover:scale-105 active:scale-95'
              },
                h('i', { 'data-lucide': 'chevron-right', className: 'w-4 h-4' })
              )
            )
          ),

          // Horizontal Video Collage Carousel Track (Pure CSS Hardware Marquee)
          h('div', {
            id: 'creator-slideshow-track',
            className: 'w-full overflow-x-auto no-scrollbar py-2 px-1 relative select-none cursor-grab active:cursor-grabbing'
          },
            h('div', { className: 'animate-marquee-left gap-4 flex items-center' },
              [...CREATOR_SPOTLIGHTS, ...CREATOR_SPOTLIGHTS].map((cr, idx) => {
                return h('div', {
                  key: `${cr.id}-${idx}`,
                  onClick: () => {
                    setSelectedVideo({
                      title: cr.title,
                      influencer: cr.name,
                      platformName: cr.product,
                      youtubeId: cr.videoUrl,
                      videoUrl: cr.videoMp4 || `https://www.youtube-nocookie.com/embed/${cr.videoUrl}?autoplay=1&mute=0&controls=1`,
                      views: cr.views,
                      duration: cr.duration,
                      description: `${cr.title} — Spotlight breakdown by ${cr.name} (${cr.handle}) on ${cr.product}.`
                    });
                  },
                  className: 'w-56 md:w-60 flex-shrink-0 relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/15 bg-neutral-950 group cursor-pointer shadow-xl transition-all duration-500 hover:border-[#00F6A7]/60 hover:shadow-[0_15px_40px_rgba(0,246,167,0.25)] hover:-translate-y-1.5'
                },
                  // Native Autoplay Looping Video Element
                  h('video', {
                    src: cr.videoMp4,
                    poster: cr.thumbnail,
                    autoPlay: true,
                    muted: true,
                    loop: true,
                    playsInline: true,
                    className: 'absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition duration-700 pointer-events-none'
                  }),

                  // Cinematic Dark Gradient Overlays
                  h('div', { className: 'absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/70 pointer-events-none z-10' }),

                  // Top Row: Creator Avatar with Story Ring & Product Badge
                  h('div', { className: 'absolute top-3 left-3 right-3 flex items-center justify-between z-20' },
                    h('div', { className: 'flex items-center gap-2 min-w-0' },
                      h('div', { className: 'relative p-0.5 rounded-full bg-gradient-to-tr from-[#00F6A7] via-[#00C8FF] to-[#4D6BFF] flex-shrink-0 shadow-md' },
                        h('img', {
                          src: cr.avatar,
                          alt: cr.name,
                          className: 'w-7 h-7 rounded-full object-cover border border-black'
                        })
                      ),
                      h('span', { className: 'font-extrabold text-xs text-white truncate drop-shadow' }, cr.name)
                    ),
                    h('span', { className: 'px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[9px] font-bold text-[#00F6A7] shadow flex-shrink-0' },
                      cr.product
                    )
                  ),

                  // Center Play Action Hologram
                  h('div', { className: 'absolute inset-0 flex items-center justify-center z-20 pointer-events-none' },
                    h('div', { className: 'w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/30 flex items-center justify-center text-white group-hover:bg-[#00F6A7] group-hover:text-black group-hover:scale-110 transition duration-300 shadow-2xl' },
                      h('i', { 'data-lucide': 'play', className: 'w-4 h-4 fill-current ml-0.5' })
                    )
                  ),

                  // Bottom Video Information & Metrics
                  h('div', { className: 'absolute bottom-3 left-3 right-3 space-y-1 z-20' },
                    h('div', { className: 'inline-block px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-[9px] font-extrabold text-amber-300' },
                      cr.tag
                    ),
                    h('h3', { className: 'text-xs md:text-sm font-black text-white leading-snug line-clamp-2 drop-shadow' },
                      cr.title
                    ),
                    h('div', { className: 'flex items-center justify-between text-[10px] text-white/80 font-mono pt-0.5' },
                      h('span', { className: 'flex items-center gap-1 text-[#00F6A7] font-bold' },
                        h('i', { 'data-lucide': 'eye', className: 'w-3 h-3' }),
                        cr.views
                      ),
                      h('span', { className: 'px-1.5 py-0.5 rounded bg-black/70 border border-white/15 font-bold text-white/90' },
                        cr.duration
                      )
                    )
                  )
                );
              })
            )
          )
        ),

        // ═══════════════════════════════════════════════════════════
        // INSTAGRAM-STYLE OFFICIAL ANNOUNCEMENTS FEED
        // ═══════════════════════════════════════════════════════════
        h('section', { className: 'space-y-12 w-full pt-4' },
          
          // Header title & Product Filter Pills
          h('div', { className: 'max-w-4xl mx-auto space-y-3.5 px-1' },
            h('div', { className: 'flex items-center justify-between' },
              h('h2', { className: 'text-base md:text-lg font-black text-white tracking-tight flex items-center gap-2' },
                h('i', { 'data-lucide': 'sparkles', className: 'w-4 h-4 text-[#00F6A7]' }),
                'Official Announcements'
              ),
              h('span', { className: 'text-xs text-white/50 font-medium' },
                `${filteredPosts.length} ${filteredPosts.length === 1 ? 'announcement' : 'announcements'}`
              )
            ),

            // Filter Pills by Product
            h('div', { className: 'flex items-center gap-2 overflow-x-auto no-scrollbar py-1' },
              h('button', {
                type: 'button',
                onClick: () => setActiveProductId('all'),
                className: `px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-sm ${activeProductId === 'all' ? 'bg-white text-black font-extrabold shadow-md' : 'bg-[#111B33] border border-white/15 text-white/70 hover:text-white'}`
              }, '✨ All'),

              [
                { id: 'neutv', name: 'NEU TV' },
                ...PRODUCTS
              ].map(prod => {
                const isSelected = activeProductId === prod.id;
                return h('button', {
                  key: prod.id,
                  type: 'button',
                  onClick: () => setActiveProductId(prod.id),
                  className: `px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-sm ${isSelected ? 'bg-gradient-to-r from-[#00F6A7] to-[#00C8FF] text-black font-black shadow-md' : 'bg-[#111B33] border border-white/15 text-white/70 hover:text-white hover:bg-white/10'}`
                },
                  h('span', { className: `w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-[#00F6A7]'}` }),
                  prod.name
                );
              })
            )
          ),

          // Render Instagram Video Post Cards (Spacious Gaps & Smooth Animation)
          filteredPosts.map(post => {
            const isLiked = likedPosts[post.id] || post.isUpvoted;
            const isSaved = savedPosts[post.id] || post.isSaved;
            const isCommentsOpen = openCommentSections[post.id];
            const isFollowing = followingUsers[post.handle];
            const commentsList = post.comments || [];

            return h('article', {
              key: post.id,
              className: 'max-w-4xl mx-auto w-full rounded-3xl bg-[#0B1220]/95 border border-white/15 overflow-hidden shadow-2xl space-y-4 p-5 md:p-7 backdrop-blur-xl transition-all duration-300 hover:border-[#00F6A7]/40 hover:shadow-[0_20px_50px_rgba(0,246,167,0.12)] hover:-translate-y-1 animate-fadeIn'
            },
              
              // 1. TOP PROFILE HEADER (INSTAGRAM STYLE)
              h('div', { className: 'flex items-center justify-between gap-3' },
                // Profile Avatar & Bio preview
                h('div', { className: 'flex items-center gap-3 min-w-0' },
                  // Avatar with Glowing Gradient Ring
                  h('div', { className: 'relative p-0.5 rounded-full bg-gradient-to-tr from-[#00F6A7] via-[#00C8FF] to-[#4D6BFF] flex-shrink-0 shadow-md' },
                    h('img', {
                      src: post.avatar,
                      alt: post.author,
                      className: 'w-10 h-10 rounded-full object-cover border-2 border-[#0B1220]'
                    })
                  ),
                  h('div', { className: 'min-w-0' },
                    h('div', { className: 'flex items-center gap-1.5 flex-wrap' },
                      h('span', { className: 'font-extrabold text-sm text-white truncate' }, post.author),
                      post.verified && h('span', {
                        title: 'Verified Official Account',
                        className: 'w-4 h-4 rounded-full bg-[#00C8FF] text-black font-black text-[10px] flex items-center justify-center flex-shrink-0'
                      }, '✓'),
                      h('span', { className: 'text-white/30 text-xs' }, '•'),
                      h('span', { className: 'text-xs text-white/50 font-mono font-medium' }, post.timestamp)
                    ),
                    h('div', { className: 'flex items-center gap-2 mt-0.5' },
                      h('span', { className: 'text-[10px] font-bold text-[#00F6A7] bg-[#00F6A7]/10 px-2 py-0.5 rounded-full border border-[#00F6A7]/25' }, post.categoryTag || post.productName),
                      h('span', { className: 'text-[11px] text-white/50 truncate hidden sm:inline' }, post.role || post.handle)
                    )
                  )
                ),

                // Follow Button & Options
                h('div', { className: 'flex items-center gap-2 flex-shrink-0' },
                  h('button', {
                    type: 'button',
                    onClick: () => handleToggleFollow(post.handle),
                    className: `px-3.5 py-1.5 rounded-full text-xs font-extrabold transition shadow-sm ${isFollowing ? 'bg-white/10 text-white/80 border border-white/20 hover:bg-white/20' : 'bg-gradient-to-r from-[#00F6A7] to-[#00C8FF] text-black hover:brightness-110'}`
                  }, isFollowing ? 'Following' : 'Follow'),

                  h('button', {
                    type: 'button',
                    onClick: () => handleSharePost(post),
                    className: 'w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white flex items-center justify-center transition border border-white/10'
                  },
                    h('i', { 'data-lucide': 'more-horizontal', className: 'w-4 h-4' })
                  )
                )
              ),

              // 2. MAIN VIDEO PLAYER FIELD (NATIVE AUTOPLAY VIDEO WITH FALLBACK)
              h('div', {
                className: 'relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl w-full group'
              },
                // Direct Autoplaying Video Stream
                h('video', {
                  src: post.videoMp4,
                  poster: post.mediaUrl,
                  autoPlay: true,
                  muted: true,
                  loop: true,
                  playsInline: true,
                  controls: true,
                  className: 'w-full h-full object-cover border-0'
                }),

                // Top badges (Platform & Views)
                h('div', { className: 'absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none' },
                  h('div', { className: 'flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white shadow-lg' },
                    h('span', { className: 'w-1.5 h-1.5 rounded-full bg-[#00F6A7]' }),
                    post.productName
                  ),
                  h('div', { className: 'px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-mono text-white/90 font-bold' },
                    `${post.views || '42.8K'} views`
                  )
                )
              ),

              // 3. INSTAGRAM ACTION BAR (LIKE, COMMENT, SHARE, GIFT, BOOKMARK)
              h('div', { className: 'flex items-center justify-between pt-1' },
                h('div', { className: 'flex items-center gap-4' },
                  
                  // Like Button (Heart)
                  h('button', {
                    type: 'button',
                    onClick: () => handleTogglePostLike(post.id),
                    className: `flex items-center gap-1.5 text-xs font-bold transition transform active:scale-125 ${isLiked ? 'text-rose-500' : 'text-white/80 hover:text-white'}`
                  },
                    h('i', {
                      'data-lucide': 'heart',
                      className: `w-6 h-6 ${isLiked ? 'fill-rose-500 stroke-rose-500' : 'stroke-current'}`
                    }),
                    h('span', { className: 'font-mono text-xs' }, (post.upvotes || 0).toLocaleString())
                  ),

                  // Comment Button (Speech Bubble)
                  h('button', {
                    type: 'button',
                    onClick: () => toggleComments(post.id),
                    className: 'flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-[#00F6A7] transition'
                  },
                    h('i', { 'data-lucide': 'message-circle', className: 'w-6 h-6' }),
                    h('span', { className: 'font-mono text-xs' }, commentsList.length)
                  ),

                  // Share Button (Paper Plane)
                  h('button', {
                    type: 'button',
                    onClick: () => handleSharePost(post),
                    className: 'flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-[#00C8FF] transition'
                  },
                    h('i', { 'data-lucide': 'send', className: 'w-5 h-5' }),
                    post.shares && h('span', { className: 'font-mono text-xs' }, post.shares)
                  ),

                  // Gift KashCoin Tip Button (Colorful Emoji)
                  h('button', {
                    type: 'button',
                    onClick: () => requireAuth('send gift', () => setIsGiftModalOpen(true)),
                    className: 'px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-400/20 border border-amber-400/40 text-amber-300 hover:bg-amber-400/30 text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-sm'
                  },
                    h('span', { className: 'text-sm' }, '🎁'),
                    h('span', null, 'Gift')
                  )
                ),

                // Bookmark / Save Button
                h('button', {
                  type: 'button',
                  onClick: () => handleToggleSavePost(post.id),
                  className: `transition transform active:scale-125 ${isSaved ? 'text-amber-400' : 'text-white/60 hover:text-white'}`
                },
                  h('i', {
                    'data-lucide': 'bookmark',
                    className: `w-6 h-6 ${isSaved ? 'fill-amber-400 stroke-amber-400' : 'stroke-current'}`
                  })
                )
              ),

              // 4. LIKES COUNT LINE
              h('div', { className: 'text-xs font-bold text-white' },
                `Liked by ${(post.upvotes || 0).toLocaleString()} viewers`
              ),

              // 5. CAPTION & HASHTAGS
              h('div', { className: 'text-xs md:text-sm text-white/90 leading-relaxed' },
                h('span', { className: 'font-black text-white mr-2' }, post.handle),
                h('span', null, post.content)
              ),

              // 6. COMMENTS SECTION & INLINE COMMENT COMPOSER
              h('div', { className: 'space-y-3 pt-2 border-t border-white/10' },
                
                // Toggle / Comments Count
                commentsList.length > 0 && h('button', {
                  type: 'button',
                  onClick: () => toggleComments(post.id),
                  className: 'text-xs text-white/50 hover:text-white font-medium'
                }, isCommentsOpen ? 'Hide comments' : `View all ${commentsList.length} comments`),

                // Comments List (when expanded)
                isCommentsOpen && commentsList.length > 0 && h('div', { className: 'space-y-2.5 max-h-48 overflow-y-auto no-scrollbar pr-1' },
                  commentsList.map(c => h('div', { key: c.id, className: 'flex items-start gap-2.5 text-xs' },
                    h('img', {
                      src: c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
                      alt: c.author,
                      className: 'w-6 h-6 rounded-full object-cover border border-white/20 flex-shrink-0 mt-0.5'
                    }),
                    h('div', { className: 'flex-1 min-w-0 leading-snug' },
                      h('span', { className: 'font-extrabold text-white mr-1.5' }, c.author),
                      h('span', { className: 'text-white/80' }, c.text),
                      h('div', { className: 'text-[10px] text-white/40 font-mono mt-0.5' }, c.timestamp)
                    )
                  ))
                ),

                // Inline Comment Composer Form
                h('form', {
                  onSubmit: (e) => handleAddPostComment(e, post.id),
                  className: 'flex items-center gap-2 pt-1'
                },
                  h('img', {
                    src: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
                    alt: currentUser ? currentUser.name : 'You',
                    className: 'w-6 h-6 rounded-full object-cover border border-white/20 flex-shrink-0'
                  }),
                  h('input', {
                    type: 'text',
                    placeholder: currentUser ? `Add a comment as ${currentUser.name}...` : 'Add a comment...',
                    value: postCommentInputs[post.id] || '',
                    onChange: (e) => setPostCommentInputs({ ...postCommentInputs, [post.id]: e.target.value }),
                    className: 'flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none focus:border-b border-[#00F6A7]/40 py-1 transition'
                  }),
                  h('button', {
                    type: 'submit',
                    disabled: !postCommentInputs[post.id] || !postCommentInputs[post.id].trim(),
                    className: 'text-xs font-bold text-[#00F6A7] hover:brightness-125 disabled:opacity-30 disabled:cursor-not-allowed transition'
                  }, 'Post')
                ),

                // Quick One-Click Reaction Emojis
                h('div', { className: 'flex items-center gap-1.5 pt-1 text-sm' },
                  ['🔥', '❤️', '👏', '🚀', '💎', '⚡'].map(emoji => h('button', {
                    key: emoji,
                    type: 'button',
                    onClick: () => handlePostReactionEmoji(post.id, emoji),
                    className: 'px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 transition active:scale-125 text-xs'
                  }, emoji))
                )
              )
            );
          })
        )

      ),

      // -------------------------------------------------------------
      // 3. RIGHT SIDEBAR — DISCORD COMMUNITY & LIVE CHAT (NEU ECOSYSTEM)
      // -------------------------------------------------------------
      h('aside', { className: 'w-80 md:w-96 h-screen flex-shrink-0 border-l border-white/10 hidden xl:flex flex-col bg-[#0B1220]/95 backdrop-blur-2xl z-40 sticky top-0 shadow-2xl overflow-hidden' },

        // Check if user has joined this community
        (() => {
          const isCommunityJoined = !!joinedCommunities[activeCommunityServerId];

          // ── STATE A: FIRST-TIME USER "JOIN COMMUNITY" WELCOME SCREEN ──
          if (!isCommunityJoined) {
            return h('div', { className: 'flex-1 overflow-y-auto p-6 flex flex-col justify-between space-y-6 no-scrollbar bg-gradient-to-b from-[#0B1220] via-[#111B33]/80 to-[#060A12]' },
              
              // Top Server Identity Card
              h('div', { className: 'text-center space-y-3 pt-2' },
                h('div', { className: 'w-16 h-16 rounded-2xl bg-[#111B33] border border-[#00F6A7]/40 shadow-[0_0_20px_rgba(0,246,167,0.25)] flex items-center justify-center mx-auto p-2 overflow-hidden shadow-lg' },
                  (() => {
                    const prod = PRODUCTS.find(p => p.id === activeCommunityServerId);
                    if (prod && prod.logo) {
                      return h('img', { src: prod.logo, alt: prod.name, className: 'w-full h-full object-contain' });
                    }
                    return h('span', { className: 'text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#00F6A7] to-[#00C8FF]' }, (activeCommunityHub.name || 'NEU')[0]);
                  })()
                ),
                h('div', { className: 'space-y-1.5' },
                  h('div', { className: 'flex items-center justify-center gap-1.5' },
                    h('h2', { className: 'text-base md:text-lg font-black text-white tracking-tight' }, `${activeCommunityHub.name} Hub`),
                    h('span', { className: 'text-[9px] px-2 py-0.5 rounded-full bg-[#00F6A7]/20 text-[#00F6A7] font-extrabold border border-[#00F6A7]/30' }, 'Verified')
                  ),
                  h('p', { className: 'text-xs text-white/70 font-medium max-w-xs mx-auto leading-relaxed' }, activeCommunityHub.tagline || 'The official community room for The New Economy.'),
                  h('div', { className: 'text-[10px] text-white/70 font-semibold mt-1 flex items-center justify-center gap-2' },
                    h('span', { className: 'flex items-center gap-1 text-white/80' },
                      h('i', { 'data-lucide': 'users', className: 'w-3 h-3 text-[#00F6A7]' }),
                      activeCommunityHub.memberCount || '40,000+ Members'
                    ),
                    h('span', { className: 'text-white/30' }, '•'),
                    h('span', { className: 'flex items-center gap-1 text-[#00F6A7] font-bold' },
                      h('span', { className: 'w-1.5 h-1.5 rounded-full bg-[#00F6A7] animate-pulse' }),
                      `${activeChannelObj.activeNow || 100}+ online`
                    )
                  )
                )
              ),

              // Locked Channels Preview
              h('div', { className: 'p-4 rounded-2xl bg-[#111B33]/60 border border-white/10 space-y-2.5 shadow-inner' },
                h('div', { className: 'text-[10px] font-extrabold uppercase tracking-wider text-white/40 flex items-center justify-between' },
                  h('span', null, 'Community Channels'),
                  h('span', { className: 'text-[9px] text-amber-400 font-bold flex items-center gap-1' },
                    h('i', { 'data-lucide': 'lock', className: 'w-3 h-3' }),
                    'Locked (Join to Chat)'
                  )
                ),
                (activeCommunityHub.channels || []).map(chan => h('div', { key: chan.id, className: 'flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white/[0.04] border border-white/5' },
                  h('div', { className: 'flex items-center gap-2 text-white/80 font-semibold' },
                    h('i', { 'data-lucide': 'lock', className: 'w-3 h-3 text-white/40' }),
                    h('span', { className: 'text-white/40' }, '#'),
                    h('span', null, chan.name.replace('#', ''))
                  ),
                  h('span', { className: 'text-[10px] text-[#00F6A7] font-medium' }, `${chan.activeNow || 0} active`)
                ))
              ),

              // Member Perks List
              h('div', { className: 'space-y-2 px-1' },
                h('div', { className: 'text-[10px] font-extrabold uppercase tracking-wider text-white/40' }, 'Member Benefits'),
                (activeCommunityHub.perks || [
                  'Real-time verified creator signals & trade setups',
                  'Instant access to community chat and discussions',
                  'Send and receive live KashCoin gifts on broadcasts'
                ]).map((perk, pIdx) => h('div', { key: pIdx, className: 'flex items-start gap-2 text-xs text-white/80' },
                  h('i', { 'data-lucide': 'check-circle-2', className: 'w-3.5 h-3.5 text-[#00F6A7] flex-shrink-0 mt-0.5' }),
                  h('span', { className: 'leading-snug' }, perk)
                ))
              ),

              // Action Buttons: Join Community & Visit Site
              h('div', { className: 'space-y-2.5 pt-2' },
                h('button', {
                  onClick: () => handleJoinCommunity(activeCommunityServerId),
                  className: 'w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00F6A7] to-[#00C8FF] hover:brightness-110 text-black font-black text-xs transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-95'
                },
                  h('i', { 'data-lucide': 'user-plus', className: 'w-4 h-4' }),
                  h('span', null, `Join ${activeCommunityHub.name} Community`)
                ),
                activeCommunityHub.officialUrl && h('a', {
                  href: activeCommunityHub.officialUrl,
                  target: '_blank',
                  rel: 'noreferrer',
                  className: 'w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition flex items-center justify-center gap-1.5'
                }, `Learn More on ${activeCommunityHub.name} Site ↗`)
              )
            );
          }

          // ── STATE B: JOINED MEMBER DISCORD LIVE CHAT ROOM ──
          return h('div', { className: 'h-full flex flex-col overflow-hidden' },

            // 1. DISCORD CHAT HEADER (Active Community & Channel)
            h('div', { className: 'px-4 py-3.5 border-b border-white/10 bg-neutral-900/60 flex items-center justify-between flex-shrink-0' },
              h('div', { className: 'flex items-center gap-2.5 min-w-0' },
                h('span', { className: 'text-white/40 text-base font-normal' }, '#'),
                h('div', { className: 'min-w-0' },
                  h('div', { className: 'flex items-center gap-2' },
                    h('span', { className: 'font-bold text-white text-sm truncate' }, activeChannelObj.name.replace('#', '')),
                    h('span', { className: 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0' })
                  ),
                  h('p', { className: 'text-[10px] text-white/50 truncate' }, `${activeCommunityHub.name} Community • ${activeChannelObj.activeNow || 0} online`)
                )
              ),
              h('div', { className: 'flex items-center gap-2 flex-shrink-0' },
                h('button', {
                  onClick: () => handleLeaveCommunity(activeCommunityServerId),
                  title: 'Click to leave or test invite screen again',
                  className: 'px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400 text-[10px] font-bold border border-emerald-500/30 transition flex items-center gap-1'
                },
                  h('i', { 'data-lucide': 'check', className: 'w-3 h-3' }),
                  h('span', null, 'Joined')
                ),
                activeCommunityHub.officialUrl && h('a', {
                  href: activeCommunityHub.officialUrl,
                  target: '_blank',
                  rel: 'noreferrer',
                  title: `Visit ${activeCommunityHub.name} Official Website`,
                  className: 'px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold border border-white/15 transition flex items-center gap-1'
                }, 'Site ↗')
              )
            ),

            // 2. CHANNEL TABS STRIP (If active community has multiple channels)
            activeCommunityHub.channels && activeCommunityHub.channels.length > 1 && h('div', { className: 'px-4 py-2 border-b border-white/[0.08] bg-black/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0' },
              activeCommunityHub.channels.map(chan => {
                const isChanActive = activeCommunityChannelId === chan.id;
                return h('button', {
                  key: chan.id,
                  onClick: () => setActiveCommunityChannelId(chan.id),
                  className: `px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${isChanActive ? 'bg-white/20 text-white font-bold border border-white/20' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`
                },
                  h('span', { className: 'text-white/40 font-normal' }, '#'),
                  chan.name.replace('#', ''),
                  h('span', { className: `text-[9px] ${isChanActive ? 'text-emerald-400 font-bold' : 'text-white/30'}` }, chan.activeNow || 0)
                );
              })
            ),

            // 3. DISCORD CHAT STREAM
            h('div', { className: 'flex-1 flex flex-col overflow-hidden bg-neutral-950/60' },
              
              // Channel Topic Bar
              activeChannelObj.topic && h('div', { className: 'px-4 py-2 border-b border-white/[0.06] bg-neutral-900/30 flex-shrink-0 flex items-center justify-between text-[11px]' },
                h('p', { className: 'text-white/50 truncate flex-1' }, `Topic: ${activeChannelObj.topic}`),
                h('span', { className: 'text-white/30 text-[10px] ml-2 flex-shrink-0' }, `${activeChannelObj.activeNow || 0} online`)
              ),

              // Messages Stream
              h('div', { className: 'flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar' },
                (communityMessages[activeChannelObj.id] || [
                  { id: 999, author: activeCommunityHub.admins ? activeCommunityHub.admins[0]?.name : 'Admin', role: 'Admin', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', timestamp: '12:00 PM', text: `Welcome to #${activeChannelObj.name.replace('#', '')}! Join the conversation.`, reactions: { '🚀': 12 } }
                ]).map(msg => h('div', { key: msg.id, className: 'flex gap-3 items-start group hover:bg-white/[0.03] -mx-2 px-2 py-1.5 rounded-xl transition' },
                  h('img', { src: msg.avatar, alt: msg.author, className: 'w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0 mt-0.5 shadow-sm' }),
                  h('div', { className: 'flex-1 min-w-0 space-y-1' },
                    h('div', { className: 'flex items-center gap-2 text-[11px]' },
                      h('span', { className: 'font-bold text-white' }, msg.author),
                      msg.role && h('span', { className: 'px-1.5 py-0.2 rounded bg-white/10 text-emerald-400 font-semibold text-[9px]' }, msg.role),
                      h('span', { className: 'text-white/30 ml-auto text-[10px]' }, msg.timestamp)
                    ),
                    h('div', { className: 'p-2.5 rounded-2xl bg-white/[0.06] text-neutral-100 border border-white/10 text-[11px] leading-relaxed break-words' }, msg.text),
                    msg.reactions && h('div', { className: 'flex items-center gap-1 pt-0.5' },
                      Object.entries(msg.reactions).map(([emoji, count], rIdx) => h('button', {
                        key: rIdx,
                        className: 'px-2 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/20 border border-white/15 text-[10px] font-semibold text-white/90 transition flex items-center gap-1'
                      }, `${emoji} ${count}`))
                    )
                  )
                ))
              ),

              // Message Composer
              h('form', { onSubmit: handleSendRightChatMessage, className: 'p-3 border-t border-white/10 flex-shrink-0 bg-neutral-900/50' },
                h('div', { className: 'flex items-center gap-2 bg-white/5 border border-white/15 rounded-2xl px-4 py-2.5 shadow-inner' },
                  h('span', { className: 'text-white/40 text-sm cursor-pointer hover:text-white transition' }, '+'),
                  h('input', {
                    type: 'text',
                    placeholder: currentUser ? `Message #${activeChannelObj.name.replace('#', '')}...` : 'Sign in to chat in community...',
                    value: rightChatInputText,
                    onChange: e => setRightChatInputText(e.target.value),
                    className: 'flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none'
                  }),
                  h('button', {
                    type: 'submit',
                    className: 'px-3 py-1 rounded-xl bg-white hover:bg-white/90 text-black font-extrabold text-xs transition shadow-md'
                  }, 'Send')
                )
              )
            )
          );
        })()
      ),

      // LIVE GIFT STORE MODAL
      isGiftModalOpen && h('div', {
        onClick: () => setIsGiftModalOpen(false),
        className: 'fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn'
      },
        h('div', {
          onClick: e => e.stopPropagation(),
          className: 'glass-card rounded-3xl w-full max-w-lg p-6 space-y-6 border border-white/20 shadow-2xl bg-neutral-950 text-white'
        },
          h('div', { className: 'flex items-center justify-between pb-3 border-b border-white/10' },
            h('div', { className: 'flex items-center gap-2.5' },
              h('div', { className: 'w-10 h-10 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center text-xl shadow-lg' },
                '🎁'
              ),
              h('div', null,
                h('h2', { className: 'text-lg font-bold text-white tracking-tight' }, 'Live Gift Store'),
                h('p', { className: 'text-xs text-amber-400 font-semibold' }, `Your Balance: ${coinBalance.toLocaleString()} KashCoins`)
              )
            ),
            h('button', { onClick: () => setIsGiftModalOpen(false), className: 'text-white/40 hover:text-white text-sm font-bold' }, '✕')
          ),

          // Gifts Grid
          h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-3.5' },
            GIFTS.map(gift => {
              const canAfford = coinBalance >= gift.cost;
              return h('button', {
                key: gift.id,
                onClick: () => handleSendGift(gift),
                className: `p-4 rounded-2xl border text-center transition flex flex-col items-center justify-between space-y-2 ${canAfford ? 'bg-white/5 border-white/15 hover:border-amber-400/50 hover:bg-amber-500/10 cursor-pointer shadow-md' : 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'}`
              },
                h('div', { className: 'w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shadow-inner' },
                  gift.emoji || '🎁'
                ),
                h('div', null,
                  h('div', { className: 'font-bold text-xs text-white' }, gift.name),
                  h('div', { className: 'text-[11px] text-amber-400 font-extrabold mt-0.5 font-mono' }, gift.label)
                )
              );
            })
          ),

          h('div', { className: 'pt-2 border-t border-white/10 text-center text-xs text-white/50' },
            'Sending gifts supports creators & triggers live animated alerts on screen!'
          )
        )
      ),

      // PERSISTENT MINI-PLAYER
      isMiniPlayer && h('div', { className: 'fixed bottom-6 right-6 z-50 w-72 md:w-80 rounded-3xl overflow-hidden glass-card border border-white/30 shadow-2xl bg-black/95 animate-fadeIn' },
        h('div', { className: 'relative aspect-video bg-black' },
          h('iframe', {
            src: `https://www.youtube-nocookie.com/embed/${centralTv.youtubeId || 'A4vbtSapWLM'}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${centralTv.youtubeId || 'A4vbtSapWLM'}&controls=0`,
            title: 'Mini Player',
            className: 'w-full h-full object-cover pointer-events-none'
          }),
          h('button', {
            onClick: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); },
            className: 'absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/80 text-white text-[10px] font-bold border border-white/20'
          }, 'Expand ↗')
        ),
        h('div', { className: 'p-3 flex items-center justify-between text-xs' },
          h('span', { className: 'font-bold text-white truncate max-w-[180px]' }, centralTv.title || 'NEU TV Stream'),
          h('button', { onClick: () => setIsMuted(!isMuted), className: 'text-white/80 font-bold text-xs' }, isMuted ? 'Unmute' : 'Mute')
        )
      ),

      // Watch Video Modal (Supports YouTube Embeds & Direct MP4s)
      selectedVideo && h('div', { className: 'fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn select-none' },
        h('div', { className: 'rounded-3xl w-full max-w-3xl overflow-hidden border border-white/20 bg-[#0B1220] shadow-[0_30px_90px_rgba(0,0,0,0.95)] flex flex-col animate-scaleUp' },
          h('div', { className: 'relative aspect-video bg-black' },
            selectedVideo.youtubeId || (selectedVideo.videoUrl && selectedVideo.videoUrl.includes('youtube')) ? h('iframe', {
              src: selectedVideo.youtubeId ? `https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1` : selectedVideo.videoUrl,
              title: selectedVideo.title,
              allow: 'autoplay; fullscreen; picture-in-picture; encrypted-media',
              allowFullScreen: true,
              className: 'w-full h-full object-cover border-0'
            }) : h('video', { src: selectedVideo.videoUrl, poster: selectedVideo.thumbnail, controls: true, autoPlay: true, className: 'w-full h-full object-cover' }),
            h('button', {
              onClick: () => setSelectedVideo(null),
              className: 'absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-white hover:text-black transition border border-white/20 z-20 shadow-xl'
            }, '✕')
          ),

          h('div', { className: 'p-6 space-y-3' },
            h('div', { className: 'flex items-center justify-between' },
              h('span', { className: 'px-3 py-1 rounded-full bg-[#00F6A7]/10 text-[#00F6A7] border border-[#00F6A7]/30 text-xs font-black' }, selectedVideo.productName || selectedVideo.platformName || 'Ecosystem'),
              h('span', { className: 'text-xs text-white/60 font-mono font-bold' }, `${selectedVideo.views} views`)
            ),
            h('h2', { className: 'text-lg md:text-xl font-black text-white leading-snug' }, selectedVideo.title),
            selectedVideo.description && h('p', { className: 'text-xs text-white/70 leading-relaxed' }, selectedVideo.description),
            h('div', { className: 'text-xs text-white/70 flex items-center justify-between pt-3 border-t border-white/10' },
              h('span', null, 'Creator Spotlight: ', h('strong', { className: 'text-white font-extrabold' }, selectedVideo.influencer)),
              h('button', {
                onClick: () => {
                  setCentralTv({
                    title: selectedVideo.title,
                    description: selectedVideo.description,
                    youtubeId: selectedVideo.youtubeId || 'xHU5MHuUSKI',
                    viewers: 42800,
                    likes: 12400
                  });
                  setSelectedVideo(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  showToast('Now broadcasting on main stage! 📺');
                },
                className: 'px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#00F6A7] to-[#00C8FF] text-black font-black text-xs hover:brightness-110 transition flex items-center gap-1.5 shadow-md'
              },
                h('i', { 'data-lucide': 'tv', className: 'w-3.5 h-3.5' }),
                'Stream on Central TV Stage'
              )
            )
          )
        )
      )
    );
  }

  window.CentralApp = App;
})();
