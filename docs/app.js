const { createApp, ref, computed } = Vue;

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function localDateStr(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TYPE_CONFIG = {
  feed: { label: '喂奶', color: '#e87c9e' },
  sleep: { label: '睡眠', color: '#7eb8e0' },
  diaper: { label: '尿布', color: '#a0d4a0' },
  vitamin: { label: '维生素AD', color: '#e8c86e' },
  bath: { label: '洗澡', color: '#88c8e8' },
  food: { label: '辅食', color: '#f0a860' },
  checkup: { label: '体检', color: '#b088d0' },
  temperature: { label: '体温', color: '#e06060' },
};

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function getWeekDates(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    dates.push({
      dateStr: localDateStr(cur),
      weekday: WEEKDAY_NAMES[i],
      day: cur.getDate(),
      month: cur.getMonth() + 1,
    });
  }
  return dates;
}

const App = {
  setup() {
    const allEvents = ref([]);
    const selectedDate = ref(localDateStr(new Date()));

    const filteredEvents = computed(() => {
      return allEvents.value.filter((e) => {
        if (!e.start_time) return false;
        return e.start_time.startsWith(selectedDate.value);
      });
    });

    const summary = computed(() => {
      const events = filteredEvents.value;
      const result = {
        feed: { count: 0, total_ml: 0 },
        sleep: { count: 0, total_minutes: 0 },
        diaper: { count: 0, pee: 0, poop: 0 },
        vitamin: { taken: false },
        bath: { count: 0, total_minutes: 0 },
        food: { count: 0 },
        checkup: { count: 0 },
        temperature: { count: 0 },
      };
      for (const e of events) {
        switch (e.type) {
          case 'feed':
            result.feed.count++;
            if (e.amount) result.feed.total_ml += e.amount;
            break;
          case 'sleep':
            result.sleep.count++;
            if (e.end_time) {
              const ms = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
              result.sleep.total_minutes += Math.floor(ms / 60000);
            }
            break;
          case 'diaper':
            result.diaper.count++;
            if (e.sub_type === 'pee') result.diaper.pee++;
            if (e.sub_type === 'poop') result.diaper.poop++;
            break;
          case 'vitamin':
            result.vitamin.taken = true;
            break;
          case 'bath':
            result.bath.count++;
            if (e.end_time) {
              const ms = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
              result.bath.total_minutes += Math.floor(ms / 60000);
            }
            break;
          case 'food':
            result.food.count++;
            break;
          case 'checkup':
            result.checkup.count++;
            break;
          case 'temperature':
            result.temperature.count++;
            break;
        }
      }
      return result;
    });

    const weekDates = computed(() => getWeekDates(selectedDate.value));

    const monthDayLabel = computed(() => {
      const d = new Date(selectedDate.value + 'T00:00:00');
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    });

    function typeColor(type) {
      return TYPE_CONFIG[type]?.color || '#999';
    }

    function typeLabel(type) {
      return TYPE_CONFIG[type]?.label || type;
    }

    function isOngoing(event) {
      return (event.type === 'sleep' || event.type === 'bath') && !event.end_time;
    }

    function formatDuration(min) {
      if (min < 60) return `${min}分钟`;
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (m === 0) return `${h}小时`;
      return `${h}时${m}分`;
    }

    function ongoingLabel(event) {
      if (!event.start_time) return '';
      const ms = Date.now() - new Date(event.start_time).getTime();
      const min = Math.floor(ms / 60000);
      if (event.type === 'sleep') return `已睡 ${formatDuration(min)}`;
      if (event.type === 'bath') return `已洗 ${formatDuration(min)}`;
      return '';
    }

    function eventDetail(event) {
      switch (event.type) {
        case 'feed':
          return event.amount ? `${event.amount}ml` : '';
        case 'sleep':
          if (event.end_time) {
            const ms = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
            return `时长:${formatDuration(Math.floor(ms / 60000))}`;
          }
          return '';
        case 'diaper': {
          let parts = [];
          if (event.sub_type === 'pee') parts.push('嘘嘘');
          if (event.sub_type === 'poop') parts.push('便便');
          if (event.color) parts.push(`(${event.color})`);
          return parts.join(' ');
        }
        case 'vitamin':
          return '✓';
        case 'bath':
          if (event.end_time) {
            const ms = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
            return `时长:${formatDuration(Math.floor(ms / 60000))}`;
          }
          return '';
        case 'food': {
          let parts = [];
          if (event.amount) parts.push(`${event.amount}ml`);
          if (event.note) parts.push(event.note);
          return parts.join(' ');
        }
        case 'checkup':
          return event.note || '';
        case 'temperature':
          return event.amount != null ? `${(event.amount / 10).toFixed(1)}°C` : '';
        default:
          return '';
      }
    }

    function selectDate(dateStr) {
      selectedDate.value = dateStr;
    }

    async function loadData() {
      try {
        const res = await fetch('./data/snapshot.json');
        allEvents.value = await res.json();
      } catch (e) {
        allEvents.value = [];
      }
    }

    loadData();

    return {
      allEvents, selectedDate, filteredEvents, summary,
      weekDates, monthDayLabel,
      formatTime, timeAgo, typeColor, typeLabel,
      isOngoing, ongoingLabel, eventDetail,
      selectDate,
    };
  },
};

createApp(App).mount('#app');
