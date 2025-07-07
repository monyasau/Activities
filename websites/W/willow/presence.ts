import { ActivityType, Assets } from 'premid'

const presence = new Presence({
  clientId: '1391558577889611939',
})
const browsingTimestamp = Math.floor(Date.now() / 1000)

interface WillowMediaMeta {
  title: string
  type: 'movie' | 'show'
  id: string
  year: number
  poster: string
}

interface WillowControls {
  isPlaying: boolean
  isLoading: boolean
}

interface WillowSeason {
  number: number
  id: string
  title: string
}

interface WillowEpisode {
  number: number
  id: string
  title: string
}

interface WillowProgress {
  time: number
  duration: number
}

interface WillowPlayerData {
  meta: WillowMediaMeta
  controls: WillowControls
  season?: WillowSeason
  episode?: WillowEpisode
  progress: WillowProgress
}

presence.on('UpdateData', async () => {
  const { pathname, href } = document.location
  const [
    showTimestamp,
    showButtons,
    showProgress,
    barLengthString,
    barTrack,
    barFill,
    showLabel,
    showThumbnails,
    privacy
  ] = await Promise.all([
    presence.getSetting<boolean>('timestamp'),
    presence.getSetting<boolean>('buttons'),
    presence.getSetting<boolean>('progress'),
    presence.getSetting<string>('barLength'),
    presence.getSetting<string>('barTrack'),
    presence.getSetting<string>('barFill'),
    presence.getSetting<boolean>('showLabel'),
    presence.getSetting<boolean>('thumbnails'),
    presence.getSetting<boolean>('privacy')
  ])

  const presenceData: PresenceData = {
    largeImageKey: 'https://cdn.rcd.gg/PreMiD/websites/W/Willow/assets/logo.png',
    type: ActivityType.Watching,
    name: 'Willow'
  }

  if (pathname === '/' || pathname === '') {
    presenceData.details = privacy ? 'Browsing' : 'Checking stuffs'
    presenceData.startTimestamp = browsingTimestamp
  } else if (pathname.startsWith('/search')) {
    const searchParams = new URLSearchParams(document.location.search)
    const query = searchParams.get('q') || 'something'
    presenceData.details = privacy ? 'Searching' : `Searching for ${query}`
    presenceData.startTimestamp = browsingTimestamp
    presenceData.smallImageKey = Assets.Search
    presenceData.smallImageText = 'Searching'
  } else if (pathname.startsWith('/categories/')) {
    const category = pathname.split('/').pop() || 'unknown'
    presenceData.details = privacy ? 'Browsing' : `Browsing Category: ${category}`
    presenceData.startTimestamp = browsingTimestamp
  } else if (pathname.startsWith('/networks/')) {
    const network = pathname.split('/').pop() || 'unknown'
    presenceData.details = privacy ? 'Browsing' : `Browsing Network: ${network}`
    presenceData.startTimestamp = browsingTimestamp
  } else if (pathname.startsWith('/movies')) {
    presenceData.details = privacy ? 'Browsing' : 'Browsing Movies'
    presenceData.startTimestamp = browsingTimestamp
  } else if (pathname.startsWith('/series/')) {
    presenceData.details = privacy ? 'Browsing' : 'Browsing Shows'
    presenceData.startTimestamp = browsingTimestamp
  } else if (pathname.startsWith('/media')) {
    const playerElement = document.querySelector('video')
    if (!playerElement) {
      presenceData.details = 'Viewing Media'
      presenceData.startTimestamp = browsingTimestamp
      presence.setActivity(presenceData)
      return
    }

    const playerData: WillowPlayerData = {
      meta: {
        title: document.title.split("-")[0] || playerElement.getAttribute('data-title') || 'Unknown Title',
        type: (playerElement.getAttribute('data-media-type') as 'movie' | 'show') || 'movie',
        id: playerElement.getAttribute('data-media-id') || 'unknown',
        year: Number.parseInt(playerElement.getAttribute('data-year') || '0', 10) || 0,
        poster: playerElement.getAttribute('data-poster') || ''
      },
      controls: {
        isPlaying: playerElement.querySelector('.controls')?.getAttribute('data-playing') === 'true',
        isLoading: playerElement.querySelector('.controls')?.getAttribute('data-loading') === 'true'
      },
      progress: {
        time: Number.parseFloat(playerElement.querySelector('.progress')?.getAttribute('data-time') || '0'),
        duration: Number.parseFloat(playerElement.querySelector('.progress')?.getAttribute('data-duration') || '0')
      },
      season: undefined,
      episode: undefined
    }

    // Extract season and episode for shows
    if (playerData.meta.type === 'show') {
      const seasonElement = playerElement.querySelector('.season')
      const episodeElement = playerElement.querySelector('.episode')
      if (seasonElement) {
        playerData.season = {
          number: Number.parseInt(seasonElement.getAttribute('data-number') || '0', 10) || 0,
          id: seasonElement.getAttribute('data-id') || 'unknown',
          title: seasonElement.getAttribute('data-title') || 'Unknown Season'
        }
      }
      if (episodeElement) {
        playerData.episode = {
          number: Number.parseInt(episodeElement.getAttribute('data-number') || '0', 10) || 0,
          id: episodeElement.getAttribute('data-id') || 'unknown',
          title: episodeElement.getAttribute('data-title') || 'Unknown Episode'
        }
      }
    }

    const { meta, progress, episode, season, controls } = playerData

    // Set thumbnail (poster) if enabled
    if (showThumbnails && meta.poster) {
      presenceData.largeImageKey = meta.poster
    }

    // Set title and details
    const title = `${meta.title} (${meta.year})`
    presenceData.name = document.title
    if (meta.type === 'show' && episode && season) {
      presenceData.details = privacy ? 'Watching a show' : `S${season.number} E${episode.number}: ${episode.title}`
      presenceData.state = title
    } else {
      presenceData.details = privacy ? 'Watching a movie' : title
    }

    // Progress bar
    if (showProgress && progress.time && progress.duration && !privacy) {
      presenceData.state = createProgressBar(progress.time, progress.duration, {
        barLengthString,
        barFill,
        barTrack,
        showLabel
      })
    }

    // Watch button
    if (showButtons && !privacy) {
      presenceData.buttons = [
        {
          label: `Watch ${meta.type.charAt(0).toUpperCase() + meta.type.slice(1)}`,
          url: href
        }
      ]
    }

    // Playback status
    if (controls.isLoading) {
      presenceData.smallImageKey = Assets.Downloading
      presenceData.smallImageText = 'Loading'
    } else if (controls.isPlaying) {
      const video = document.querySelector<HTMLVideoElement>('video')
      if (video && showTimestamp) {
        [presenceData.startTimestamp, presenceData.endTimestamp] = presence.getTimestampsfromMedia(video)
      }
      presenceData.smallImageKey = Assets.Play
      presenceData.smallImageText = 'Playing'
    } else {
      presenceData.smallImageKey = Assets.Pause
      presenceData.smallImageText = 'Paused'
    }
  } else {
    presenceData.details = privacy ? 'Browsing' : 'Browsing Willow'
    presenceData.startTimestamp = browsingTimestamp
  }

  // Remove timestamps if disabled
  if (!showTimestamp) {
    delete presenceData.startTimestamp
    delete presenceData.endTimestamp
  }

  presence.setActivity(presenceData)
})

function createProgressBar(
  time: number,
  duration: number,
  options: {
    barLengthString: string
    barTrack: string
    barFill: string
    showLabel: boolean
  }
): string {
  const { barLengthString, barTrack, barFill, showLabel } = options
  const barLength = Number.isNaN(Number.parseInt(barLengthString, 10))
    ? 10
    : Number.parseInt(barLengthString, 10)
  const progress = Math.floor((time / duration) * 100)
  const numChars = Math.floor((progress / 100) * barLength)

  return `${barFill.repeat(numChars)}${barTrack.repeat(barLength - numChars)}${showLabel ? ` ${progress}%` : ''}`.trimEnd()
}