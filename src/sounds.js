// ~200 everyday sounds for Sound Bingo.
// Every sound should be something a normal person in a city or suburb
// could plausibly encounter or produce on any given day.
//
// Difficulty guide:
//   1 = Easy  — indoor / on-demand (you can make it happen)
//   2 = Medium — common but situational (step outside, visit a shop)
//   3 = Hard  — requires some luck or deliberate seeking

export const SOUND_POOL = [

  // ─── KITCHEN & COOKING ────────────────────────────────────────────

  { id: 'microwave_beep',    name: 'Microwave Beep',    icon: 'Microwave',       match: 'microwave beeping or dinging when finished',                       difficulty: 1 },
  { id: 'blender',           name: 'Blender',           icon: 'CookingPot',      match: 'blender or food processor whirring and grinding',                   difficulty: 1 },
  { id: 'sizzling_pan',      name: 'Sizzling Pan',      icon: 'EggFried',        match: 'food sizzling and crackling in a hot pan or on a grill',            difficulty: 1 },
  { id: 'kettle_boiling',    name: 'Kettle Boiling',    icon: 'Coffee',          match: 'kettle whistling or rumbling as water boils',                       difficulty: 1 },
  { id: 'dishes_clinking',   name: 'Dishes Clinking',   icon: 'Utensils',        match: 'ceramic or glass dishes clinking together while washing or stacking', difficulty: 1 },
  { id: 'cutlery_clatter',   name: 'Cutlery Clatter',   icon: 'UtensilsCrossed', match: 'metallic rattling of forks, knives, and spoons',                    difficulty: 1 },
  { id: 'coffee_grinder',    name: 'Coffee Grinder',    icon: 'Coffee',          match: 'electric coffee grinder whirring and grinding beans',                difficulty: 1 },
  { id: 'dishwasher',        name: 'Dishwasher',        icon: 'WashingMachine',  match: 'muffled sloshing and humming of a dishwasher mid-cycle',             difficulty: 1 },
  { id: 'garbage_disposal',  name: 'Garbage Disposal',  icon: 'Settings',        match: 'loud grinding and churning of a sink garbage disposal',              difficulty: 1 },
  { id: 'oven_timer',        name: 'Oven Timer',        icon: 'Timer',           match: 'oven timer buzzing or beeping',                                     difficulty: 1 },
  { id: 'pot_lid',           name: 'Pot Lid Clang',     icon: 'CookingPot',      match: 'metallic clang of a pot or pan lid being set down or bumped',        difficulty: 1 },
  { id: 'chopping_board',    name: 'Chopping',          icon: 'UtensilsCrossed', match: 'rhythmic tapping of a knife hitting a cutting board',                difficulty: 1 },
  { id: 'running_faucet',    name: 'Running Faucet',    icon: 'Droplets',        match: 'water flowing from a faucet or tap into a sink',                     difficulty: 1 },
  { id: 'coffee_drip',       name: 'Coffee Maker',      icon: 'Coffee',          match: 'gurgling and dripping of a drip coffee maker brewing',               difficulty: 1 },
  { id: 'popcorn',           name: 'Popcorn',           icon: 'Popcorn',         match: 'rapid popping of popcorn kernels in a microwave or pot',             difficulty: 1 },

  // ─── BATHROOM ─────────────────────────────────────────────────────

  { id: 'shower',            name: 'Shower',            icon: 'ShowerHead',      match: 'continuous hissing spray of water from a showerhead',                difficulty: 1 },
  { id: 'toilet_flush',      name: 'Toilet Flush',      icon: 'Droplet',         match: 'rushing water swirl and refill of a toilet being flushed',           difficulty: 1 },
  { id: 'electric_toothbrush', name: 'Electric Toothbrush', icon: 'Vibrate',     match: 'high-frequency buzzing of an electric toothbrush motor',             difficulty: 1 },
  { id: 'hair_dryer',        name: 'Hair Dryer',        icon: 'Wind',            match: 'loud sustained blowing and motor whine of a hair dryer',             difficulty: 1 },
  { id: 'electric_razor',    name: 'Electric Razor',    icon: 'Scissors',        match: 'steady buzzing hum of an electric shaver or trimmer',                difficulty: 1 },
  { id: 'bathtub_filling',   name: 'Bathtub Filling',   icon: 'Bath',            match: 'deep rushing sound of water pouring into a bathtub',                 difficulty: 1 },
  { id: 'hand_washing',      name: 'Hand Washing',      icon: 'Droplets',        match: 'water running and hands rubbing together while washing',              difficulty: 1 },

  // ─── HOME & HOUSEHOLD ────────────────────────────────────────────

  { id: 'vacuum',            name: 'Vacuum Cleaner',    icon: 'AirVent',         match: 'loud sustained suction roar of a vacuum cleaner',                    difficulty: 1 },
  { id: 'washing_machine',   name: 'Washing Machine',   icon: 'WashingMachine',  match: 'rhythmic sloshing and mechanical churning of a washing machine',      difficulty: 1 },
  { id: 'dryer',             name: 'Dryer',             icon: 'Fan',             match: 'steady tumbling thump and motor hum of a clothes dryer',              difficulty: 1 },
  { id: 'doorbell',          name: 'Doorbell',          icon: 'BellElectric',    match: 'electronic chime or ding-dong of a doorbell',                        difficulty: 2 },
  { id: 'alarm_clock',       name: 'Alarm Clock',       icon: 'AlarmClock',      match: 'repetitive beeping or ringing of an alarm clock',                    difficulty: 1 },
  { id: 'smoke_detector',    name: 'Smoke Detector',    icon: 'Bell',            match: 'loud piercing chirp of a smoke detector',                            difficulty: 2 },
  { id: 'clock_ticking',     name: 'Clock Ticking',     icon: 'Clock',           match: 'steady rhythmic tick-tock of an analog clock',                       difficulty: 2 },
  { id: 'ceiling_fan',       name: 'Ceiling Fan',       icon: 'Fan',             match: 'soft rhythmic whooshing of ceiling fan blades spinning',              difficulty: 1 },
  { id: 'ac_unit',           name: 'AC Unit',           icon: 'AirVent',         match: 'low steady hum and airflow of an air conditioning unit',              difficulty: 1 },
  { id: 'door_slam',         name: 'Door Slam',         icon: 'DoorClosed',      match: 'heavy abrupt bang of a door being shut forcefully',                   difficulty: 1 },
  { id: 'keys_jangling',     name: 'Keys Jangling',     icon: 'Key',             match: 'metallic jingling and rattling of keys on a keyring',                 difficulty: 1 },
  { id: 'door_knocking',     name: 'Door Knock',        icon: 'DoorClosed',      match: 'rhythmic rapping of knuckles on a wooden door',                      difficulty: 1 },
  { id: 'lock_turning',      name: 'Lock Turning',      icon: 'Lock',            match: 'mechanical clicking and bolt sliding of a lock being turned',         difficulty: 1 },
  { id: 'sliding_door',      name: 'Sliding Door',      icon: 'DoorOpen',        match: 'rumbling and clicking of a sliding glass door on its track',          difficulty: 1 },
  { id: 'drawer_sliding',    name: 'Drawer Open',       icon: 'Home',            match: 'wooden or metallic sliding of a drawer being opened or closed',       difficulty: 1 },
  { id: 'gate_latch',        name: 'Gate Latch',        icon: 'Fence',           match: 'metallic click and clank of a garden or fence gate latch',            difficulty: 2 },
  { id: 'broom_sweeping',    name: 'Sweeping',          icon: 'Home',            match: 'soft rhythmic bristle scratching of a broom on a floor',              difficulty: 1 },
  { id: 'ironing',           name: 'Ironing',           icon: 'Flame',           match: 'hissing press and steam burst of an iron on fabric',                  difficulty: 2 },
  { id: 'garage_door',       name: 'Garage Door',       icon: 'DoorOpen',        match: 'mechanical rumbling and chain rattling of a garage door',              difficulty: 2 },

  // ─── OFFICE & WORK ───────────────────────────────────────────────

  { id: 'typing',            name: 'Typing',            icon: 'Keyboard',        match: 'rapid clicking and clacking of fingers on a computer keyboard',       difficulty: 1 },
  { id: 'printer',           name: 'Printer',           icon: 'Printer',         match: 'mechanical whirring and paper feeding of a printer',                  difficulty: 2 },
  { id: 'stapler',           name: 'Stapler',           icon: 'Stamp',           match: 'sharp metallic snap of a stapler punching through paper',              difficulty: 1 },
  { id: 'paper_tearing',     name: 'Paper Tearing',     icon: 'BookOpen',        match: 'quick ripping sound of paper being torn',                             difficulty: 1 },
  { id: 'paper_crumpling',   name: 'Paper Crumpling',   icon: 'Trash2',          match: 'crunching and crackling of paper being balled up',                    difficulty: 1 },
  { id: 'scissors_cutting',  name: 'Scissors',          icon: 'Scissors',        match: 'metallic sliding snip of scissors cutting through material',           difficulty: 1 },
  { id: 'pen_clicking',      name: 'Pen Clicking',      icon: 'Pen',             match: 'repetitive spring-loaded click of a retractable pen',                 difficulty: 1 },
  { id: 'desk_drawer',       name: 'Desk Drawer',       icon: 'Briefcase',       match: 'sliding and thudding of a desk drawer being opened or closed',         difficulty: 1 },

  // ─── HUMAN SOUNDS ────────────────────────────────────────────────

  { id: 'laughter',          name: 'Laughter',          icon: 'Laugh',           match: 'people laughing, giggling, chuckling, or cackling',                   difficulty: 1 },
  { id: 'coughing',          name: 'Coughing',          icon: 'Volume1',         match: 'someone coughing or clearing their throat',                           difficulty: 1 },
  { id: 'sneezing',          name: 'Sneezing',          icon: 'Zap',             match: 'sudden explosive burst of a human sneeze',                            difficulty: 2 },
  { id: 'yawning',           name: 'Yawning',           icon: 'Meh',             match: 'drawn-out open-mouthed inhalation of a yawn',                         difficulty: 1 },
  { id: 'clapping',          name: 'Clapping',          icon: 'Hand',            match: 'rhythmic slapping of palms clapping together',                        difficulty: 1 },
  { id: 'finger_snapping',   name: 'Finger Snap',       icon: 'Hand',            match: 'crisp popping snap of fingers',                                      difficulty: 1 },
  { id: 'blowing_nose',      name: 'Blowing Nose',      icon: 'Wind',            match: 'forceful nasal expulsion into a tissue',                              difficulty: 1 },
  { id: 'footsteps',         name: 'Footsteps',         icon: 'Footprints',      match: 'rhythmic tapping or thudding of a person walking on a hard surface',  difficulty: 1 },
  { id: 'running_steps',     name: 'Running',           icon: 'Footprints',      match: 'rapid heavy footfalls of someone running',                            difficulty: 2 },
  { id: 'gargling',          name: 'Gargling',          icon: 'Waves',           match: 'bubbling and gurgling of liquid being gargled in the throat',          difficulty: 1 },
  { id: 'hiccup',            name: 'Hiccup',            icon: 'Zap',             match: 'short involuntary spasmodic hiccup sound',                            difficulty: 2 },
  { id: 'snoring',           name: 'Snoring',           icon: 'Bed',             match: 'rhythmic raspy breathing of someone snoring',                         difficulty: 2 },
  { id: 'baby_crying',       name: 'Baby Crying',       icon: 'Baby',            match: 'high-pitched wailing cry of an infant or baby',                       difficulty: 3 },
  { id: 'throat_clearing',   name: 'Throat Clearing',   icon: 'Ear',             match: 'short rough guttural sound of someone clearing their throat',          difficulty: 1 },

  // ─── VOICE & MUSIC ───────────────────────────────────────────────

  { id: 'singing',           name: 'Singing',           icon: 'MicVocal',        match: 'a person singing or vocalizing a melody',                             difficulty: 1 },
  { id: 'humming',           name: 'Humming',           icon: 'Music',           match: 'closed-mouth continuous melodic humming',                             difficulty: 1 },
  { id: 'whistling',         name: 'Whistling',         icon: 'AudioLines',      match: 'clear airy melodic tone of someone whistling',                        difficulty: 1 },
  { id: 'music_speaker',     name: 'Music Playing',     icon: 'Headphones',      match: 'music playing audibly from a speaker, stereo, or headphones',         difficulty: 1 },
  { id: 'guitar',            name: 'Guitar',            icon: 'Guitar',          match: 'guitar strumming or picking — acoustic, electric, or bass',            difficulty: 3 },
  { id: 'piano',             name: 'Piano',             icon: 'Piano',           match: 'piano or keyboard notes being played',                                difficulty: 3 },
  { id: 'drums',             name: 'Drums',             icon: 'Drum',            match: 'drums being played — drum kit, snare, bass drum, or percussion',       difficulty: 3 },
  { id: 'beatboxing',        name: 'Beatboxing',        icon: 'Mic',             match: 'vocal percussion imitating drum sounds with the mouth',                difficulty: 2 },
  { id: 'ukulele',           name: 'Ukulele',           icon: 'Guitar',          match: 'light bright strumming of ukulele strings',                           difficulty: 3 },
  { id: 'harmonica',         name: 'Harmonica',         icon: 'Music',           match: 'reedy melodic tone of a harmonica being played',                      difficulty: 3 },
  { id: 'recorder',          name: 'Recorder',          icon: 'Music',           match: 'airy high-pitched breathy tone of a recorder instrument',              difficulty: 3 },
  { id: 'tv_audio',          name: 'Television',        icon: 'Tv',              match: 'television audio — dialogue, commercials, news, or show soundtracks',  difficulty: 1 },
  { id: 'radio',             name: 'Radio',             icon: 'Radio',           match: 'audio from a radio — music, talk show, or news broadcast',             difficulty: 1 },

  // ─── ANIMALS ──────────────────────────────────────────────────────

  { id: 'dog_barking',       name: 'Dog Barking',       icon: 'Dog',             match: 'a dog barking, yipping, or yelping',                                  difficulty: 2 },
  { id: 'dog_whining',       name: 'Dog Whining',       icon: 'Dog',             match: 'high-pitched whimpering or whining of a dog',                         difficulty: 2 },
  { id: 'cat_meowing',       name: 'Cat Meowing',       icon: 'Cat',             match: 'a cat meowing or yowling',                                           difficulty: 2 },
  { id: 'cat_purring',       name: 'Cat Purring',       icon: 'Cat',             match: 'low continuous rumbling vibration of a cat purring',                   difficulty: 2 },
  { id: 'bird_chirping',     name: 'Bird Song',         icon: 'Bird',            match: 'birds singing, chirping, tweeting, or calling',                       difficulty: 2 },
  { id: 'crow_cawing',       name: 'Crow Cawing',       icon: 'Bird',            match: 'harsh raspy repeated caw of a crow or raven',                        difficulty: 2 },
  { id: 'pigeon_cooing',     name: 'Pigeon Cooing',     icon: 'Bird',            match: 'soft low repetitive cooing of a pigeon',                             difficulty: 2 },
  { id: 'insect_buzzing',    name: 'Insect Buzzing',    icon: 'Bug',             match: 'high-pitched buzzing of a fly, bee, or mosquito nearby',              difficulty: 2 },
  { id: 'geese_honking',     name: 'Geese Honking',     icon: 'Bird',            match: 'loud nasal honking calls of geese flying or on the ground',           difficulty: 3 },

  // ─── WEATHER & NATURE ────────────────────────────────────────────

  { id: 'rain',              name: 'Rain',              icon: 'CloudRain',       match: 'continuous patter and splashing of raindrops on surfaces',             difficulty: 2 },
  { id: 'heavy_rain',        name: 'Heavy Rain',        icon: 'CloudRain',       match: 'dense loud roar of heavy rainfall or a downpour',                     difficulty: 3 },
  { id: 'thunder',           name: 'Thunder',           icon: 'CloudLightning',  match: 'deep rumbling or sharp crack of thunder',                             difficulty: 3 },
  { id: 'wind_blowing',      name: 'Wind',              icon: 'Wind',            match: 'sustained rushing and whooshing of wind',                             difficulty: 2 },
  { id: 'wind_chimes',       name: 'Wind Chimes',       icon: 'Bell',            match: 'melodic tinkling and clanging of wind chimes in a breeze',             difficulty: 2 },
  { id: 'leaves_rustling',   name: 'Leaves Rustling',   icon: 'Leaf',            match: 'soft dry shuffling of wind moving through tree leaves',                difficulty: 2 },
  { id: 'water_dripping',    name: 'Water Dripping',    icon: 'Droplet',         match: 'rhythmic individual drops of water hitting a surface',                 difficulty: 1 },
  { id: 'rain_on_window',    name: 'Rain on Window',    icon: 'CloudRain',       match: 'tapping and streaking of raindrops hitting a glass window',            difficulty: 2 },
  { id: 'water_stream',      name: 'Water Stream',      icon: 'Waves',           match: 'continuous gentle rushing of a creek, stream, or fountain',            difficulty: 2 },
  { id: 'hail',              name: 'Hail',              icon: 'Snowflake',       match: 'sharp irregular rattling of ice pellets striking a hard surface',       difficulty: 3 },

  // ─── VEHICLES & TRANSPORT ────────────────────────────────────────

  { id: 'car_horn',          name: 'Car Horn',          icon: 'CarFront',        match: 'short sharp blast of a car horn honking',                             difficulty: 2 },
  { id: 'car_engine_start',  name: 'Car Starting',      icon: 'Car',             match: 'cranking ignition and revving of a car engine starting up',            difficulty: 2 },
  { id: 'car_idling',        name: 'Engine Idling',     icon: 'Car',             match: 'low steady rumble of a car or truck engine at rest',                   difficulty: 2 },
  { id: 'bus_brakes',        name: 'Bus Brakes',        icon: 'Bus',             match: 'loud hissing pneumatic release of bus air brakes',                     difficulty: 2 },
  { id: 'motorcycle',        name: 'Motorcycle',        icon: 'Gauge',           match: 'deep loud throaty rumble of a motorcycle engine',                      difficulty: 2 },
  { id: 'bicycle_bell',      name: 'Bicycle Bell',      icon: 'Bike',            match: 'bright metallic ring-ring of a bicycle bell',                         difficulty: 2 },
  { id: 'car_door_slam',     name: 'Car Door',          icon: 'Car',             match: 'heavy metallic thud of a car door closing',                           difficulty: 1 },
  { id: 'turn_signal',       name: 'Turn Signal',       icon: 'Navigation',      match: 'rhythmic soft clicking of a car turn signal indicator',                difficulty: 2 },
  { id: 'car_backing_up',    name: 'Reversing Beep',    icon: 'Car',             match: 'repetitive beeping warning tone of a vehicle reversing',               difficulty: 2 },
  { id: 'airplane_overhead',  name: 'Airplane',         icon: 'Plane',           match: 'low sustained rumble of an airplane passing overhead',                 difficulty: 2 },
  { id: 'tires_gravel',      name: 'Tires on Gravel',   icon: 'Car',             match: 'crunching and popping of tires rolling over gravel',                   difficulty: 2 },
  { id: 'car_alarm',         name: 'Car Alarm',         icon: 'Siren',           match: 'repetitive cycling honks and wails of a car alarm',                    difficulty: 2 },
  { id: 'train_horn',        name: 'Train Horn',        icon: 'TrainFront',      match: 'deep powerful horn blast of a passing train',                          difficulty: 3 },
  { id: 'helicopter',        name: 'Helicopter',        icon: 'Plane',           match: 'thumping chopping rotor sound of a helicopter overhead',               difficulty: 3 },

  // ─── URBAN SOUNDS ────────────────────────────────────────────────

  { id: 'siren',             name: 'Siren',             icon: 'Siren',           match: 'rising and falling wail of an emergency vehicle siren',                difficulty: 2 },
  { id: 'construction',      name: 'Construction',      icon: 'Construction',    match: 'loud construction noise — jackhammer, drilling, or heavy machinery',    difficulty: 2 },
  { id: 'crosswalk_beep',    name: 'Crosswalk Signal',  icon: 'TrafficCone',     match: 'rhythmic pulsing beep of a pedestrian crossing signal',                difficulty: 2 },
  { id: 'skateboard',        name: 'Skateboard',        icon: 'Gauge',           match: 'rough sustained rumble of skateboard wheels on pavement',              difficulty: 2 },
  { id: 'lawn_mower',        name: 'Lawn Mower',        icon: 'Home',            match: 'loud steady motor drone of a lawn mower running',                     difficulty: 2 },
  { id: 'leaf_blower',       name: 'Leaf Blower',       icon: 'Wind',            match: 'high-pitched sustained roar of a leaf blower',                        difficulty: 2 },
  { id: 'hammering',         name: 'Hammering',         icon: 'Hammer',          match: 'rhythmic metallic banging of a hammer striking nails',                 difficulty: 2 },
  { id: 'power_drill',       name: 'Power Drill',       icon: 'Drill',           match: 'high-pitched whirring and buzzing of an electric drill',               difficulty: 2 },
  { id: 'garbage_truck',     name: 'Garbage Truck',     icon: 'Truck',           match: 'loud hydraulic crunching and engine roar of a garbage truck',           difficulty: 2 },
  { id: 'sprinkler',         name: 'Sprinkler',         icon: 'Droplets',        match: 'rhythmic clicking and spraying of a lawn sprinkler rotating',           difficulty: 2 },
  { id: 'ice_cream_truck',   name: 'Ice Cream Truck',   icon: 'Music',           match: 'tinny melodic jingle from a moving ice cream truck',                   difficulty: 3 },
  { id: 'street_musician',   name: 'Street Musician',   icon: 'MicVocal',        match: 'live acoustic music being performed outdoors by a busker',              difficulty: 3 },
  { id: 'chainsaw',          name: 'Chainsaw',          icon: 'Construction',    match: 'aggressive revving and buzzing of a chainsaw',                         difficulty: 3 },
  { id: 'traffic_noise',     name: 'Traffic',           icon: 'Truck',           match: 'general traffic noise — passing vehicles, road hum, tires',            difficulty: 2 },

  // ─── TECHNOLOGY ───────────────────────────────────────────────────

  { id: 'phone_ringing',     name: 'Phone Ringing',     icon: 'Phone',           match: 'ringing or ringtone of a phone receiving a call',                      difficulty: 1 },
  { id: 'text_notification', name: 'Notification',      icon: 'Smartphone',      match: 'short chime or buzz of a phone notification',                         difficulty: 1 },
  { id: 'camera_shutter',    name: 'Camera Shutter',    icon: 'Camera',          match: 'click-snap of a camera taking a photo',                               difficulty: 1 },
  { id: 'phone_vibrating',   name: 'Phone Vibrating',   icon: 'Vibrate',         match: 'buzzing vibration of a phone on a surface',                           difficulty: 1 },
  { id: 'video_game',        name: 'Video Game',        icon: 'Gamepad',         match: 'electronic beeps, music, and effects from a video game',               difficulty: 1 },
  { id: 'voice_assistant',   name: 'Voice Assistant',   icon: 'Speaker',         match: 'synthesized speech from Siri, Alexa, or Google Assistant',              difficulty: 1 },
  { id: 'facetime_ring',     name: 'Video Call Ring',    icon: 'Laptop',          match: 'distinctive ringing tone of a FaceTime or video call',                 difficulty: 1 },
  { id: 'computer_startup',  name: 'Computer Startup',  icon: 'Laptop',          match: 'chime or boot sound of a computer powering on',                        difficulty: 2 },
  { id: 'scanner_beep',      name: 'Scanner Beep',      icon: 'QrCode',          match: 'electronic beep of a barcode or QR code scanner',                      difficulty: 2 },

  // ─── FOOD & DRINK ────────────────────────────────────────────────

  { id: 'pouring_liquid',    name: 'Pouring Liquid',    icon: 'GlassWater',      match: 'glugging and splashing of liquid poured into a glass or cup',          difficulty: 1 },
  { id: 'ice_clinking',      name: 'Ice Clinking',      icon: 'Wine',            match: 'sharp rattling clink of ice cubes in a glass',                        difficulty: 1 },
  { id: 'can_opening',       name: 'Can Opening',       icon: 'Beer',            match: 'metallic crack and hiss of a pull-tab beverage can',                   difficulty: 1 },
  { id: 'chip_bag',          name: 'Chip Bag',          icon: 'Package',         match: 'loud crinkling and crackling of a foil snack bag',                     difficulty: 1 },
  { id: 'crunching_food',    name: 'Crunching Food',    icon: 'Apple',           match: 'audible crunching of someone eating something crispy',                  difficulty: 1 },
  { id: 'slurping',          name: 'Slurping',          icon: 'CupSoda',         match: 'loud slurping sound of drinking soup, noodles, or a hot drink',         difficulty: 1 },
  { id: 'carbonation_fizz',  name: 'Fizzy Drink',       icon: 'CupSoda',         match: 'hissing and bubbling fizz of a freshly opened carbonated drink',        difficulty: 1 },
  { id: 'bottle_cap',        name: 'Bottle Cap',        icon: 'Beer',            match: 'metallic crack of twisting off a bottle cap',                          difficulty: 1 },
  { id: 'stirring_cup',      name: 'Stirring Drink',    icon: 'Coffee',          match: 'clinking of a spoon stirring liquid in a mug or glass',                difficulty: 1 },
  { id: 'bottle_uncorking',  name: 'Uncorking Bottle',  icon: 'Wine',            match: 'hollow pop of a cork being pulled from a bottle',                      difficulty: 2 },

  // ─── SPORTS & PLAY ───────────────────────────────────────────────

  { id: 'bouncing_ball',     name: 'Bouncing Ball',     icon: 'Target',          match: 'rhythmic rubbery thumping of a ball bouncing on a hard surface',        difficulty: 2 },
  { id: 'whistle_blow',      name: 'Whistle Blow',      icon: 'AudioLines',      match: 'sharp shrill blast of a sports or referee whistle',                    difficulty: 2 },
  { id: 'cheering_crowd',    name: 'Cheering',          icon: 'Users',           match: 'roaring collective voices of a crowd celebrating or cheering',          difficulty: 2 },
  { id: 'splash_water',      name: 'Splash',            icon: 'Waves',           match: 'sudden burst of water from someone jumping or splashing in',            difficulty: 2 },
  { id: 'balloon_pop',       name: 'Balloon Pop',       icon: 'Balloon',         match: 'sharp sudden bang of a balloon bursting',                              difficulty: 2 },
  { id: 'shuffling_cards',   name: 'Shuffling Cards',   icon: 'Gamepad',         match: 'rapid fluttering and snapping of playing cards being shuffled',          difficulty: 1 },
  { id: 'dice_rolling',      name: 'Dice Rolling',      icon: 'Gamepad',         match: 'clattering tumble of dice rolling across a surface',                   difficulty: 1 },
  { id: 'ping_pong',         name: 'Ping Pong',         icon: 'Target',          match: 'rapid alternating light clicking of a ping pong ball',                  difficulty: 2 },
  { id: 'swingset',          name: 'Swingset',          icon: 'Baby',            match: 'rhythmic metallic creaking of playground swing chains',                 difficulty: 2 },
  { id: 'soccer_kick',       name: 'Ball Kick',         icon: 'Target',          match: 'dull heavy thud of a foot kicking a ball',                             difficulty: 2 },

  // ─── SHOPPING & PUBLIC ───────────────────────────────────────────

  { id: 'cash_register',     name: 'Cash Register',     icon: 'Banknote',        match: 'electronic beeping and drawer ding of a cash register',                difficulty: 2 },
  { id: 'shopping_cart',     name: 'Shopping Cart',      icon: 'ShoppingCart',    match: 'rattling metallic rolling of a shopping cart',                         difficulty: 2 },
  { id: 'elevator_ding',     name: 'Elevator Ding',     icon: 'Bell',            match: 'clear single chime of an elevator arriving at a floor',                difficulty: 2 },
  { id: 'coins_dropping',    name: 'Coins Dropping',    icon: 'Coins',           match: 'metallic clattering of coins being dropped or counted',                difficulty: 1 },
  { id: 'vending_machine',   name: 'Vending Machine',   icon: 'Package',         match: 'mechanical thunking of a vending machine dispensing a product',          difficulty: 2 },
  { id: 'pa_announcement',   name: 'PA Announcement',   icon: 'Megaphone',       match: 'amplified voice making a public address announcement over speakers',     difficulty: 2 },
  { id: 'hand_dryer',        name: 'Hand Dryer',        icon: 'AirVent',         match: 'loud roaring blast of a public restroom hand dryer',                   difficulty: 2 },
  { id: 'coffee_steamer',    name: 'Espresso Steamer',  icon: 'Coffee',          match: 'loud high-pitched hissing of an espresso machine steaming milk',        difficulty: 2 },
  { id: 'self_checkout',     name: 'Self Checkout',     icon: 'QrCode',          match: 'scanning beeps and voice prompts of a self-checkout machine',           difficulty: 2 },
  { id: 'receipt_printing',  name: 'Receipt Printer',   icon: 'Receipt',         match: 'rapid buzzing of a thermal receipt printer',                           difficulty: 2 },
  { id: 'automatic_door',    name: 'Automatic Door',    icon: 'DoorOpen',        match: 'pneumatic whoosh of automatic sliding doors opening',                   difficulty: 2 },
  { id: 'escalator',         name: 'Escalator',         icon: 'Construction',    match: 'continuous mechanical hum and step-clacking of an escalator',           difficulty: 2 },
  { id: 'crowd_chatter',     name: 'Crowd Chatter',     icon: 'Users',           match: 'many people talking at once — restaurant, cafe, or public space',       difficulty: 2 },
  { id: 'service_bell',      name: 'Service Bell',      icon: 'ConciergeBell',   match: 'single bright ding of a service or concierge bell being tapped',        difficulty: 2 },
  { id: 'water_fountain',    name: 'Water Fountain',    icon: 'Droplets',        match: 'pressurized arc and splashing of a drinking fountain',                  difficulty: 2 },

  // ─── MORE EASY ────────────────────────────────────────────────────

  { id: 'tapping_table',     name: 'Tapping Table',     icon: 'Hand',            match: 'fingers drumming or tapping rhythmically on a table or desk',           difficulty: 1 },
  { id: 'book_page',         name: 'Page Turning',      icon: 'BookOpen',        match: 'soft flicking and rustling of book or magazine pages being turned',      difficulty: 1 },
  { id: 'jar_opening',       name: 'Jar Opening',       icon: 'Package',         match: 'pop and hiss of a vacuum-sealed jar lid being opened',                  difficulty: 1 },
  { id: 'zipping',           name: 'Zipper',            icon: 'Briefcase',       match: 'metallic zipping sound of a zipper opening or closing',                 difficulty: 1 },
  { id: 'bubble_wrap',       name: 'Bubble Wrap',       icon: 'Package',         match: 'rapid popping of bubble wrap being squeezed',                           difficulty: 1 },
  { id: 'cracking_knuckles', name: 'Cracking Knuckles', icon: 'Hand',            match: 'popping or cracking sounds of finger joints being flexed',              difficulty: 1 },

  // ─── MORE MEDIUM ──────────────────────────────────────────────────

  { id: 'children_playing',  name: 'Children Playing',  icon: 'Baby',            match: 'children laughing, shouting, and playing at a park or playground',       difficulty: 2 },
  { id: 'dog_panting',       name: 'Dog Panting',       icon: 'Dog',             match: 'rapid breathy open-mouthed panting of a dog',                           difficulty: 2 },
  { id: 'squeaky_shoes',     name: 'Squeaky Shoes',     icon: 'Footprints',      match: 'squeaking of shoes on a wet or polished floor',                         difficulty: 2 },
  { id: 'atm_beeping',       name: 'ATM Beeping',       icon: 'Banknote',        match: 'electronic key-press beeps of an ATM machine',                          difficulty: 2 },
  { id: 'elevator_doors',    name: 'Elevator Doors',    icon: 'DoorOpen',        match: 'mechanical sliding and bumping of elevator doors opening or closing',     difficulty: 2 },
  { id: 'shopping_bag',      name: 'Bag Rustling',      icon: 'ShoppingBag',     match: 'crinkling and rustling of a plastic or paper bag',                       difficulty: 2 },
  { id: 'trash_can_lid',     name: 'Trash Can Lid',     icon: 'Trash2',          match: 'metallic clang of a trash can lid being lifted or dropped',              difficulty: 2 },
  { id: 'door_creaking',     name: 'Door Creaking',     icon: 'DoorOpen',        match: 'long drawn-out squeak of a door hinge as a door opens slowly',           difficulty: 2 },
  { id: 'flagpole',          name: 'Flagpole Rope',     icon: 'Wind',            match: 'metallic clanging of a flagpole halyard or rope in the wind',            difficulty: 2 },
  { id: 'dog_collar',        name: 'Dog Collar Jingle', icon: 'Dog',             match: 'metallic jingling of dog tags on a collar',                             difficulty: 2 },
  { id: 'revolving_door',    name: 'Revolving Door',    icon: 'DoorOpen',        match: 'whooshing and mechanical turning of a revolving door',                   difficulty: 2 },
  { id: 'parking_gate',      name: 'Parking Gate',      icon: 'Car',             match: 'mechanical whirring and clunking of a parking garage gate lifting',       difficulty: 2 },

  // ─── MORE HARD ────────────────────────────────────────────────────

  { id: 'church_bells',      name: 'Church Bells',      icon: 'Bell',            match: 'church bells ringing, bell tower chimes, or large bells tolling',        difficulty: 3 },
  { id: 'fireworks',         name: 'Fireworks',         icon: 'Sparkles',        match: 'bangs, crackles, and whistles of fireworks going off',                   difficulty: 3 },
  { id: 'violin',            name: 'Violin',            icon: 'Music',           match: 'bowed string sounds of a violin or fiddle being played',                 difficulty: 3 },
  { id: 'trumpet',           name: 'Trumpet',           icon: 'Music',           match: 'bright brassy tone of a trumpet being played',                          difficulty: 3 },
  { id: 'saxophone',         name: 'Saxophone',         icon: 'Music',           match: 'smooth reedy tone of a saxophone being played',                         difficulty: 3 },
  { id: 'car_wash',          name: 'Car Wash',          icon: 'Car',             match: 'spraying, brushing, and mechanical sounds of a car wash',                difficulty: 3 },
  { id: 'jackhammer',        name: 'Jackhammer',        icon: 'Drill',           match: 'loud rapid percussive hammering of a jackhammer on concrete',            difficulty: 3 },
  { id: 'train_tracks',      name: 'Train on Tracks',   icon: 'TrainFront',      match: 'rhythmic metallic clacking of train wheels rolling on rails',            difficulty: 3 },
  { id: 'live_band',         name: 'Live Band',         icon: 'Guitar',          match: 'amplified live band playing — electric instruments and vocals',           difficulty: 3 },
  { id: 'tram_bell',         name: 'Tram Bell',         icon: 'Bell',            match: 'bright ringing bell of a tram or streetcar',                             difficulty: 3 },
  { id: 'rooster',           name: 'Rooster',           icon: 'Sunrise',         match: 'loud cock-a-doodle-doo crowing of a rooster',                           difficulty: 3 },
];

// ── Emoji map (for the shareable progress string) ───────────────────

const EMOJIS = {
  microwave_beep:'📻', blender:'🍹', sizzling_pan:'🍳', kettle_boiling:'☕', dishes_clinking:'🍽️',
  cutlery_clatter:'🍴', coffee_grinder:'⚙️', dishwasher:'🫧', garbage_disposal:'🗑️', oven_timer:'⏲️',
  pot_lid:'🍲', chopping_board:'🔪', running_faucet:'🚰', coffee_drip:'☕', popcorn:'🍿',
  shower:'🚿', toilet_flush:'🚽', electric_toothbrush:'🪥', hair_dryer:'💇', electric_razor:'✂️',
  bathtub_filling:'🛁', hand_washing:'🧼',
  vacuum:'🧹', washing_machine:'🧺', dryer:'👕', doorbell:'🔔', alarm_clock:'⏰',
  smoke_detector:'🔥', clock_ticking:'🕐', ceiling_fan:'💨', ac_unit:'❄️', door_slam:'🚪',
  keys_jangling:'🔑', door_knocking:'✊', lock_turning:'🔒', sliding_door:'🚪', drawer_sliding:'🗄️',
  gate_latch:'🏡', broom_sweeping:'🧹', ironing:'👔', garage_door:'🏠',
  typing:'⌨️', printer:'🖨️', stapler:'📎', paper_tearing:'📃',
  paper_crumpling:'📃', scissors_cutting:'✂️', pen_clicking:'🖊️', desk_drawer:'💼',
  laughter:'😂', coughing:'😷', sneezing:'🤧', yawning:'🥱', clapping:'👏',
  finger_snapping:'🫰', blowing_nose:'🤧', footsteps:'👣', running_steps:'🏃', gargling:'💦',
  hiccup:'😮', snoring:'😴', baby_crying:'👶', throat_clearing:'🗣️',
  singing:'🎤', humming:'🎵', whistling:'🎶', music_speaker:'🎧', guitar:'🎸', piano:'🎹',
  drums:'🥁', beatboxing:'🎤', ukulele:'🎸', harmonica:'🎵', recorder:'🎵', tv_audio:'📺', radio:'📻',
  dog_barking:'🐕', dog_whining:'🐕', cat_meowing:'🐱', cat_purring:'🐱', bird_chirping:'🐦',
  crow_cawing:'🐦‍⬛', pigeon_cooing:'🕊️', insect_buzzing:'🪲', geese_honking:'🪿',
  rain:'🌧️', heavy_rain:'🌧️', thunder:'⛈️', wind_blowing:'💨', wind_chimes:'🎐',
  leaves_rustling:'🍃', water_dripping:'💧', rain_on_window:'🌧️', water_stream:'🌊', hail:'❄️',
  car_horn:'🚗', car_engine_start:'🚙', car_idling:'🚘', bus_brakes:'🚌', motorcycle:'🏍️',
  bicycle_bell:'🚲', car_door_slam:'🚗', turn_signal:'🚗',   car_backing_up:'🚗', airplane_overhead:'✈️', tires_gravel:'🛞', car_alarm:'🚨',
  train_horn:'🚂', helicopter:'🚁',
  siren:'🚨', construction:'🏗️', crosswalk_beep:'🚶', skateboard:'🛹', lawn_mower:'🏡',
  leaf_blower:'🍂', hammering:'🔨', power_drill:'🔧', garbage_truck:'🚛', sprinkler:'💦',
  ice_cream_truck:'🍦', street_musician:'🎵', chainsaw:'🪚', traffic_noise:'🚗',
  phone_ringing:'📱', text_notification:'📲', camera_shutter:'📷', phone_vibrating:'📳',
  video_game:'🎮', voice_assistant:'🔊', facetime_ring:'💻', computer_startup:'💻', scanner_beep:'📟',
  pouring_liquid:'🥤', ice_clinking:'🧊', can_opening:'🥫', chip_bag:'🛍️', crunching_food:'🍎',
  slurping:'🍜', carbonation_fizz:'🥤', bottle_cap:'🍺', stirring_cup:'☕', bottle_uncorking:'🍾',
  bouncing_ball:'⚽', whistle_blow:'📣', cheering_crowd:'👥', splash_water:'💦', balloon_pop:'🎈',
  shuffling_cards:'🃏', dice_rolling:'🎲', ping_pong:'🏓', swingset:'🛝', soccer_kick:'⚽',
  cash_register:'💰', shopping_cart:'🛒', elevator_ding:'🛗', coins_dropping:'🪙',
  vending_machine:'📦', pa_announcement:'📢', hand_dryer:'🫧', coffee_steamer:'☕',
  self_checkout:'🏧', receipt_printing:'🧾', automatic_door:'🚪', escalator:'🏗️',
  crowd_chatter:'👥', service_bell:'🛎️', water_fountain:'⛲',
  tapping_table:'👆', book_page:'📖', jar_opening:'🫙', zipping:'👝', bubble_wrap:'🫧',
  cracking_knuckles:'✊',
  children_playing:'👧', dog_panting:'🐕', squeaky_shoes:'👟', atm_beeping:'🏧',
  elevator_doors:'🛗', shopping_bag:'🛍️', trash_can_lid:'🗑️', door_creaking:'🚪',
  flagpole:'🏳️', dog_collar:'🐕', revolving_door:'🔄', parking_gate:'🅿️',
  church_bells:'⛪', fireworks:'🎆', violin:'🎻', trumpet:'🎺', saxophone:'🎷',
  car_wash:'🧽', jackhammer:'🔨', train_tracks:'🛤️', live_band:'🎸', tram_bell:'🚃', rooster:'🐓',
};

SOUND_POOL.forEach(s => { s.emoji = EMOJIS[s.id] || '🔊'; });

// ── Seeded PRNG ─────────────────────────────────────────────────────

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate a 9-cell bingo grid for the given date string (YYYY-MM-DD).
 * 3 easy + 3 medium + 3 hard, shuffled into a random arrangement.
 */
// Bump this to reshuffle today's grid (also invalidates saved state).
export const GRID_VERSION = 3;

export function generateGrid(dateStr) {
  const rng = seededRandom(dateStr + ':v' + GRID_VERSION);

  const easy   = shuffle(SOUND_POOL.filter((s) => s.difficulty === 1), rng).slice(0, 3);
  const medium = shuffle(SOUND_POOL.filter((s) => s.difficulty === 2), rng).slice(0, 3);
  const hard   = shuffle(SOUND_POOL.filter((s) => s.difficulty === 3), rng).slice(0, 3);

  return shuffle([...easy, ...medium, ...hard], rng);
}
