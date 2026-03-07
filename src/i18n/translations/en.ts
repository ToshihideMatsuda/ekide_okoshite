const en = {
    // Common
    'common.ok': 'OK',
    'common.cancel': 'Cancel',
    'common.error': 'Error',
    'common.loading': 'Loading...',
    'common.reset': 'Reset',
    'common.done': 'Done',
    'common.failed': 'Operation failed.',

    // App
    'app.title': 'Wake Me at Station',

    // Tabs
    'tabs.home': 'Home',
    'tabs.history': 'History',
    'tabs.settings': 'Settings',

    // History screen
    'history.screenTitle': 'History',

    // Home
    'home.startSession': 'Start Detection',
    'home.startSessionSub': 'Set your destination to avoid missing your stop',
    'home.noHistory': 'No history yet',
    'home.sessionActiveTitle': 'Detection Active',
    'home.sessionActiveMessage': 'Station detection is already active. Go to the detection screen?',
    'home.goToSession': 'Go',

    // Session new (headphone detection)
    'session.new.headphoneConnected': 'Headphones connected',
    'session.new.headphoneNotConnected': 'Headphones not connected - Alarm not available',

    // Session new
    'session.new.screenTitle': 'Set Route',
    'session.new.locating': 'Getting nearest station from current location...',
    'session.new.origin': 'Origin Station',
    'session.new.destination': 'Destination',
    'session.new.originPlaceholder': 'Enter origin station',
    'session.new.destPlaceholder': 'Enter destination station (e.g. Mitaka, Shibuya)',
    'session.new.sound': 'Sound',
    'session.new.soundAlarm': 'Alarm',
    'session.new.soundMusic': 'Music',
    'session.new.soundVibration': 'Notification only',
    'session.new.radius': 'Detection Radius',
    'session.new.radiusHint': 'Use a larger value for subway or urban areas',
    'session.new.confirm': 'Start',
    'session.new.errorNoOrigin': 'Please set an origin station.',
    'session.new.errorNoDest': 'Please set a destination.',
    'session.new.errorSameStation': 'Origin and destination are the same.',
    'session.new.calcErrorTitle': 'Route Calculation Error',
    'session.new.calcErrorFallback': 'Route calculation failed.',

    // Session confirm
    'session.confirm.screenTitle': 'Confirm Route',
    'session.confirm.heading': 'Please check your route',
    'session.confirm.totalStations': '{count} stations',
    'session.confirm.detectionRadius': 'Detection radius: {radius}m',
    'session.confirm.soundLabel': 'Sound: {type}',
    'session.confirm.start': 'Start',
    'session.confirm.noRoute': 'No route data found.',
    'session.confirm.startErrorFallback': 'Failed to start detection.',
    'session.confirm.routeIndex': 'Route {current} / {total}',

    // Session active
    'session.active.route': 'Route  Wake me at this station!',
    'session.active.screenTitle': 'Detection Active',
    'session.active.status': 'Detection Active',
    'session.active.originLabel': 'From',
    'session.active.destinationLabel': 'To',
    'session.active.stationsCount': 'Route: {count} stations',
    'session.active.detectionRadius': 'Detection radius: {radius}m',
    'session.active.countdown': 'Time Remaining',
    'session.active.end': 'End Detection',
    'session.active.endTitle': 'End Detection',
    'session.active.endMessage': 'End station detection and remove geofences?',
    'session.active.endConfirm': 'End',
    'session.active.soundLabel': 'Sound',
    'session.active.radius': 'Detection Radius',
    'session.active.headphoneConnected': 'Headphones connected',
    'session.active.headphoneNotConnected': 'Not connected',
    'session.active.alarmNote': 'Will auto-switch to vibration if headphones disconnect',
    'session.active.debugTitle': 'DEBUG CONTROLS',
    'session.active.debugSubway': 'Subway {state}',
    'session.active.debugGpsLowAccuracy': 'GPS Low Accuracy {state}',
    'session.active.debugHeadphone': 'Headphone {state}',
    'session.active.debugArrive': 'Arrive Destination',
    'session.active.debugTapMove': 'Long-press Move {state}',
    'session.active.safetySafe': 'GPS Status: Good',
    'session.active.safetySafeBody': 'Arrival detection is expected to work.',
    'session.active.safetyDanger': 'GPS Status: Low Accuracy',
    'session.active.safetyDangerBody': 'In underground sections, arrival detection cannot be technically guaranteed.',
    'session.active.safetyDangerAction': 'Until you return above ground, treat this feature as assistive only.',
    'session.active.gpsDangerAlert': 'GPS accuracy is low, so stations may not be detected correctly.',
    'session.active.subwayDangerStrong': 'In underground sections, arrival detection cannot be technically guaranteed',
    'session.active.subwayDebugForced': 'Debug: Forced as subway and evaluated as danger state',

    // Alarm fired
    'alarm.fired.title': 'Approaching Your Station!',
    'alarm.fired.stationSuffix': '',
    'alarm.fired.subtitle': 'Time to wake up!',
    'alarm.fired.dismiss': 'I\'m awake! (Stop)',

    // Arrived screen
    'alarm.arrived.title': 'You have arrived at your destination!',
    'alarm.arrived.stationSuffix': '',
    'alarm.arrived.dismiss': 'Close',

    // Settings
    'settings.arrivalCount': 'Arrived {count} times',
    'settings.screenTitle': 'Settings',
    'settings.sectionData': 'Data',
    'settings.reimport': 'Re-import Station Data',
    'settings.reimportSub': 'Reload station data from CSV files',
    'settings.reimportTitle': 'Reset Database',
    'settings.reimportMessage': 'Station data will be re-imported on next launch.\n\nProceed?',
    'settings.reimportDone': 'Station data will be re-imported on next launch.',
    'settings.sectionAbout': 'About',
    'settings.privacy': 'Privacy Policy',
    'settings.terms': 'Terms of Service',
    'settings.version': 'Version',
    'settings.sectionLanguage': '言語 / Language',
    'settings.langJa': '日本語',
    'settings.langEn': 'English',
    'settings.reimportConfirm': 'Reset',
    'settings.sectionNotices': 'Notices',
    'settings.noticeText':
        '• Background location tracking consumes battery.\n\n• iOS allows a maximum of 20 geofences at once. If the route exceeds 20 stations, only the stations near the destination will be registered.\n\n• In subway or low-GPS environments, a larger detection radius is recommended.\n\n• Station data is provided by ekidata.jp (https://ekidata.jp/). Shinkansen stations are not supported.',

    // Station search
    'stationSearch.placeholder': 'Enter station name',
    'stationSearch.noResult': 'No stations found matching "{keyword}"',

    // Session card
    'sessionCard.statusActive': 'Detecting',
    'sessionCard.statusCompleted': 'Completed',
    'sessionCard.statusCancelled': 'Cancelled',
    'sessionCard.stations': '{count} stations',
    'sessionCard.deleteTitle': 'Delete History',
    'sessionCard.deleteMessage': 'Delete this history entry?',
    'sessionCard.delete': 'Delete',

    // Notification
    'notification.title': '🚉 Approaching your station!',
    'notification.body': 'Approaching {station}. Time to wake up!',

    // Subway warning
    'subway.warningTitle': 'Route includes underground sections',
    'subway.warningBody': 'In areas where GPS signals are weak, such as underground subway sections, detection accuracy may be reduced.',
    'subway.warningStations': 'Affected stations: {stations}',

    // Route edit
    'routeEdit.screenTitle': 'Edit Route',
    'routeEdit.addTransfer': 'Add Transfer',
    'routeEdit.confirm': 'Confirm Changes',
    'routeEdit.cancel': 'Cancel',
    'routeEdit.origin': 'Origin (fixed)',
    'routeEdit.destination': 'Destination (fixed)',
    'routeEdit.transfer': 'Transfer',
    'routeEdit.unreachable': 'Cannot reach selected station. Please choose another.',
    'routeEdit.truncateWarning': 'Subsequent transfers and destination cannot be reached and will be removed. Continue?',
    'routeEdit.applied': 'Route updated.',
    'routeEdit.applying': 'Recalculating route...',

    // Session active - route edit & save
    'session.active.editRoute': 'Edit Route',
    'session.active.saveRoute': 'Save',
    'session.active.routeSaved': 'Saved to My Routes',

    // My Route
    'myRoute.screenTitle': 'My Routes',
    'myRoute.empty': 'No saved routes yet',
    'myRoute.startButton': 'Start This Route',
    'myRoute.deleteTitle': 'Delete',
    'myRoute.deleteMessage': 'Delete this saved route?',
    'myRoute.delete': 'Delete',
    'myRoute.starting': 'Starting...',
    'myRoute.duplicateTitle': 'Already Saved',
    'myRoute.duplicateMessage': 'A route with the same origin, transfers, and destination is already saved in My Routes.',

    // Home
    'home.myRoutes': 'My Routes',

    // Privacy Policy
    'privacy.screenTitle': 'Privacy Policy',
    'privacy.updated': 'Last updated: March 5, 2026',
    'privacy.section1Title': '1. Information We Collect',
    'privacy.section1Body': 'This app uses only location data (GPS) to determine your nearest station and detect when you approach your destination station (geofencing), including background location access.',
    'privacy.section2Title': '2. How We Use Your Information',
    'privacy.section2Body': 'Location data is used solely to trigger the alarm when you approach your destination station. It is not used for any other purpose.',
    'privacy.section3Title': '3. Data Storage & Transmission',
    'privacy.section3Body': 'All data is stored only on your device. Nothing is sent to external servers or shared with third parties.',
    'privacy.section4Title': '4. Advertising & Analytics',
    'privacy.section4Body': 'This app contains no ads and does not use any analytics or behavioral tracking tools.',
    'privacy.section5Title': '5. Contact',
    'privacy.section5Body': 'For questions about this privacy policy, please reach out via the App Store review.',

    // Errors
    'error.loadSessions': 'Failed to load detection history',
    'error.startSession': 'Failed to start detection',
    'error.completeSession': 'Failed to complete detection',
    'error.cancelSession': 'Failed to cancel detection',
    'error.deleteSession': 'Failed to delete history entry',
    'error.noRoute': 'No route found. Please check the station combination.',
} as const;

export default en;
