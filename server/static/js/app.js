const { createApp, ref, computed, watch, onMounted, nextTick, reactive } = Vue;

function nowLocalISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalISO(input) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateStr(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TYPE_CONFIG = {
  feed: { label: '喂奶', color: '#e87c9e', icon: '🍼' },
  sleep: { label: '睡眠', color: '#7eb8e0', icon: '💤' },
  diaper: { label: '尿布', color: '#a0d4a0', icon: '🧷' },
  vitamin: { label: '维生素AD', color: '#e8c86e', icon: '💊' },
  bath: { label: '洗澡', color: '#88c8e8', icon: '🛁' },
  food: { label: '辅食', color: '#f0a860', icon: '🍜' },
  checkup: { label: '体检', color: '#b088d0', icon: '🏥' },
  temperature: { label: '体温', color: '#e06060', icon: '🌡️' },
};

const DIAPER_COLORS = [
  { value: '黄色', hex: '#f0d060' },
  { value: '绿色', hex: '#80c060' },
  { value: '棕色', hex: '#a08060' },
  { value: '黑色', hex: '#444444' },
  { value: '白色', hex: '#dddddd' },
  { value: '粉色', hex: '#f0a0b0' },
];

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

const confirmState = reactive({
  show: false,
  title: '',
  desc: '',
  okText: '确认',
  icon: '⚠️',
});

let _confirmResolve = null;
let _confirmReject = null;

function askConfirm({ title, desc, okText, icon }) {
  return new Promise((resolve, reject) => {
    _confirmResolve = resolve;
    _confirmReject = reject;
    confirmState.show = true;
    confirmState.title = title || '确认操作';
    confirmState.desc = desc || '';
    confirmState.okText = okText || '确认';
    confirmState.icon = icon || '⚠️';
  });
}

const WheelPicker = {
  name: 'WheelPicker',
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: `
    <div class="wheel-picker">
      <div class="wheel-column" ref="dateCol" @scroll="onScrollDate">
        <div class="wheel-spacer"></div>
        <div v-for="item in dateItems" :key="'d'+item.value"
             class="wheel-item" :class="{ active: item.value === datePicked }">
          {{ item.label }}
        </div>
        <div class="wheel-spacer"></div>
      </div>
      <div class="wheel-column" ref="hourCol" @scroll="onScrollHour">
        <div class="wheel-spacer"></div>
        <div v-for="item in hourItems" :key="'h'+item.value"
             class="wheel-item" :class="{ active: item.value === hourPicked }">
          {{ item.label }}
        </div>
        <div class="wheel-spacer"></div>
      </div>
      <div class="wheel-column" ref="minCol" @scroll="onScrollMin">
        <div class="wheel-spacer"></div>
        <div v-for="item in minItems" :key="'m'+item.value"
             class="wheel-item" :class="{ active: item.value === minPicked }">
          {{ item.label }}
        </div>
        <div class="wheel-spacer"></div>
      </div>
      <div class="wheel-mask"></div>
      <div class="wheel-highlight"></div>
    </div>
  `,
  setup(props, { emit }) {
    const ITEM_H = 36;
    const dateCol = ref(null);
    const hourCol = ref(null);
    const minCol = ref(null);
    const datePicked = ref('');
    const hourPicked = ref('');
    const minPicked = ref('');

    const now = new Date();
    const padN = (n) => String(n).padStart(2, '0');

    const dateItems = computed(() => {
      const items = [];
      const start = new Date();
      start.setDate(now.getDate() - 30);
      const end = new Date();
      end.setDate(now.getDate() + 7);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = localDateStr(d);
        const m = d.getMonth() + 1;
        const day = d.getDate();
        items.push({ value: ds, label: `${m}月${day}日` });
      }
      return items;
    });

    const hourItems = computed(() => {
      const items = [];
      for (let i = 0; i < 24; i++) {
        items.push({ value: String(i), label: padN(i) });
      }
      return items;
    });

    const minItems = computed(() => {
      const items = [];
      for (let i = 0; i < 60; i += 5) {
        items.push({ value: String(i), label: padN(i) });
      }
      return items;
    });

    function parseValue(val) {
      if (!val) return { date: localDateStr(now), hour: String(now.getHours()), min: '0' };
      const d = new Date(val);
      if (isNaN(d.getTime())) return { date: localDateStr(now), hour: String(now.getHours()), min: '0' };
      const m = d.getMinutes();
      const rounded = Math.round(m / 5) * 5;
      const minStr = String(rounded >= 60 ? 0 : rounded);
      const hourStr = String(rounded >= 60 ? (d.getHours() + 1) % 24 : d.getHours());
      return { date: localDateStr(d), hour: hourStr, min: minStr };
    }

    function buildISO(date, hour, min) {
      return `${date}T${padN(Number(hour))}:${padN(Number(min))}`;
    }

    function emitIfReady() {
      if (datePicked.value && hourPicked.value !== '' && minPicked.value !== '') {
        emit('update:modelValue', buildISO(datePicked.value, hourPicked.value, minPicked.value));
      }
    }

    let scrollTimerDate = null;
    let scrollTimerHour = null;
    let scrollTimerMin = null;

    function scrollSnap(colRef, items, pickedRef, emitFn) {
      return () => {
        const el = colRef.value;
        if (!el) return;
        const idx = Math.round(el.scrollTop / ITEM_H);
        const clamped = Math.max(0, Math.min(idx, items.value ? items.value.length - 1 : 0));
        pickedRef.value = items.value ? items.value[clamped].value : '';
        emitFn();
      };
    }

    const onScrollDate = () => {
      if (scrollTimerDate) clearTimeout(scrollTimerDate);
      scrollTimerDate = setTimeout(scrollSnap(dateCol, dateItems, datePicked, emitIfReady), 100);
    };
    const onScrollHour = () => {
      if (scrollTimerHour) clearTimeout(scrollTimerHour);
      scrollTimerHour = setTimeout(scrollSnap(hourCol, hourItems, hourPicked, emitIfReady), 100);
    };
    const onScrollMin = () => {
      if (scrollTimerMin) clearTimeout(scrollTimerMin);
      scrollTimerMin = setTimeout(scrollSnap(minCol, minItems, minPicked, emitIfReady), 100);
    };

    function scrollToCol(colRef, items, targetVal) {
      if (!colRef || !items) return;
      const idx = items.findIndex((i) => i.value === targetVal);
      if (idx >= 0) {
        nextTick(() => {
          requestAnimationFrame(() => {
            colRef.scrollTop = idx * ITEM_H;
          });
        });
      }
    }

    function syncFromModel() {
      const { date, hour, min } = parseValue(props.modelValue);
      datePicked.value = date;
      hourPicked.value = hour;
      minPicked.value = min;
      nextTick(() => {
        requestAnimationFrame(() => {
          scrollToCol(dateCol.value, dateItems.value, date);
          scrollToCol(hourCol.value, hourItems.value, hour);
          scrollToCol(minCol.value, minItems.value, min);
        });
      });
    }

    onMounted(syncFromModel);

    watch(() => props.modelValue, syncFromModel);

    return {
      dateCol, hourCol, minCol,
      dateItems, hourItems, minItems,
      datePicked, hourPicked, minPicked,
      onScrollDate, onScrollHour, onScrollMin,
    };
  },
};

const App = {
  components: { WheelPicker },
  setup() {
    const STORED_NAME = localStorage.getItem('babytrack:babyName') || '';
    const STORED_BIRTH = localStorage.getItem('babytrack:babyBirth') || '';

    const babyName = ref(STORED_NAME || '鱼宝');
    const babyBirthDate = ref(STORED_BIRTH);
    const showOnboarding = ref(!STORED_NAME || !STORED_BIRTH);

    const onboardingName = ref(STORED_NAME || '');
    const onboardingBirth = ref(STORED_BIRTH);
    const onboardingError = ref('');

    const showNameEdit = ref(false);
    const babyNameInput = ref(babyName.value);
    const selectedDate = ref(localDateStr(new Date()));
    const events = ref([]);
    const summary = ref(null);
    const modal = ref(null);
    const showMorePanel = ref(false);
    const showEndPicker = ref(false);
    
    const currentView = ref('home');
    const statsPeriod = ref('week');
    
    const sleepChartRef = ref(null);
    const feedChartRef = ref(null);
    const diaperChartRef = ref(null);
    const tempChartRef = ref(null);
    
    let sleepChart = null;
    let feedChart = null;
    let diaperChart = null;
    let tempChart = null;

    const form = ref({
      id: null,
      type: '',
      start_time: '',
      end_time: '',
      amount: null,
      sub_type: null,
      color: null,
      note: '',
    });

    const confirm = confirmState;

    const todayStr = computed(() => localDateStr(new Date()));

    const weekDates = computed(() => getWeekDates(selectedDate.value));

    const canGoPrev = computed(() => {
      if (!babyBirthDate.value) return false;
      const mon = new Date(selectedDate.value + 'T00:00:00');
      const day = mon.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      mon.setDate(mon.getDate() + offset);
      return localDateStr(mon) > babyBirthDate.value;
    });

    const canGoNext = computed(() => {
      const mon = new Date(selectedDate.value + 'T00:00:00');
      const day = mon.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      mon.setDate(mon.getDate() + offset);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return localDateStr(sun) < todayStr.value;
    });

    const monthDayLabel = computed(() => {
      const d = new Date(selectedDate.value + 'T00:00:00');
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    });

    const datePickerMin = computed(() => babyBirthDate.value || '2020-01-01');
    const datePickerMax = computed(() => todayStr.value);

    const tempDisplay = computed({
      get: () => {
        if (form.value.amount != null && (form.value.type === 'temperature' || modal.value === 'temperature')) {
          return (form.value.amount / 10).toFixed(1);
        }
        return '';
      },
      set: (val) => {
        if (val !== '' && val !== null) {
          form.value.amount = Math.round(parseFloat(val) * 10);
        } else {
          form.value.amount = null;
        }
      },
    });

    const modalTitle = computed(() => {
      if (modal.value === 'edit') return `编辑${TYPE_CONFIG[form.value.type]?.label || '事件'}`;
      if (modal.value === 'start') return '开始时间';
      return TYPE_CONFIG[modal.value]?.label || '';
    });

    const submitLabel = computed(() => {
      if (modal.value === 'start') return '开始';
      return '保存';
    });

    const quickAmounts = [30, 60, 90, 120, 150, 180];
    const diaperColors = DIAPER_COLORS;

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
            const min = Math.floor(ms / 60000);
            return `时长:${formatDuration(min)}`;
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
            const min = Math.floor(ms / 60000);
            return `时长:${formatDuration(min)}`;
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

    function formatDateTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    async function fetchEvents() {
      const res = await fetch(`/api/events?date=${selectedDate.value}`);
      events.value = await res.json();
    }

    async function fetchSummary() {
      const res = await fetch(`/api/summary/${selectedDate.value}`);
      summary.value = await res.json();
    }

    function selectDate(dateStr) {
      selectedDate.value = dateStr;
    }

    function goToday() {
      selectedDate.value = localDateStr(new Date());
    }

    function goPrevWeek() {
      const d = new Date(selectedDate.value + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      const ds = localDateStr(d);
      if (babyBirthDate.value && ds < babyBirthDate.value) {
        selectedDate.value = babyBirthDate.value;
      } else {
        selectedDate.value = ds;
      }
    }

    function goNextWeek() {
      const d = new Date(selectedDate.value + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      const ds = localDateStr(d);
      if (ds > todayStr.value) {
        selectedDate.value = todayStr.value;
      } else {
        selectedDate.value = ds;
      }
    }

    function jumpDate(e) {
      const val = e.target.value;
      if (val) selectedDate.value = val;
    }

    watch(selectedDate, () => {
      fetchEvents();
      fetchSummary();
    });

    function openModal(type) {
      form.value = {
        id: null,
        type: type,
        start_time: selectedDate.value + 'T' + nowLocalISO().slice(11),
        end_time: '',
        amount: null,
        sub_type: type === 'diaper' ? 'pee' : null,
        color: type === 'diaper' ? '黄色' : null,
        note: '',
      };
      showEndPicker.value = false;
      modal.value = type;
      showMorePanel.value = false;
    }

    function openEdit(event) {
      form.value = {
        id: event.id,
        type: event.type,
        start_time: toLocalISO(event.start_time),
        end_time: event.end_time ? toLocalISO(event.end_time) : '',
        amount: event.amount ?? null,
        sub_type: event.sub_type || null,
        color: event.color || null,
        note: event.note || '',
      };
      showEndPicker.value = false;
      modal.value = 'edit';
    }

    function closeModal() {
      modal.value = null;
      showEndPicker.value = false;
    }

    async function submitForm() {
      const payload = { type: form.value.type };
      if (form.value.start_time) payload.start_time = form.value.start_time;
      if (form.value.type === 'sleep' || form.value.type === 'bath') {
        payload.end_time = form.value.end_time || null;
      }
      if (form.value.type === 'feed' || form.value.type === 'food' || form.value.type === 'temperature') {
        if (form.value.amount !== null && form.value.amount !== '') {
          payload.amount = Number(form.value.amount);
        }
      }
      if (form.value.sub_type) payload.sub_type = form.value.sub_type;
      if (form.value.color) payload.color = form.value.color;
      if (form.value.note) payload.note = form.value.note;

      if (modal.value === 'edit' && form.value.id) {
        await fetch(`/api/events/${form.value.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      fetchEvents();
      fetchSummary();
    }

    async function handleSleep() {
      const ongoing = events.value.find((e) => e.type === 'sleep' && !e.end_time);
      if (ongoing) {
        try {
          await askConfirm({
            title: '宝宝醒了吗？',
            desc: '将记录睡眠结束时间',
            okText: '记录睡醒',
            icon: '😴',
          });
          await fetch(`/api/events/${ongoing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ end_time: nowLocalISO() }),
          });
          fetchEvents();
          fetchSummary();
        } catch (e) { /* user cancelled */ }
        return;
      }
      openModal('start');
      form.value.type = 'sleep';
    }

    async function handleBath() {
      showMorePanel.value = false;
      const ongoing = events.value.find((e) => e.type === 'bath' && !e.end_time);
      if (ongoing) {
        try {
          await askConfirm({
            title: '洗完澡了吗？',
            desc: '将记录洗澡结束时间',
            okText: '记录结束',
            icon: '🛁',
          });
          await fetch(`/api/events/${ongoing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ end_time: nowLocalISO() }),
          });
          fetchEvents();
          fetchSummary();
        } catch (e) { /* user cancelled */ }
        return;
      }
      openModal('start');
      form.value.type = 'bath';
    }

    async function endOngoing(event) {
      try {
        await askConfirm({
          title: event.type === 'sleep' ? '宝宝醒了吗？' : '洗完了吗？',
          desc: '将记录结束时间',
          okText: event.type === 'sleep' ? '记录睡醒' : '记录结束',
          icon: event.type === 'sleep' ? '😴' : '🛁',
        });
        await fetch(`/api/events/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ end_time: nowLocalISO() }),
        });
        fetchEvents();
        fetchSummary();
      } catch (e) { /* user cancelled */ }
    }

    async function handleVitamin() {
      try {
        await askConfirm({
          title: '确认记录维生素AD？',
          desc: '今天已经吃过维生素AD了吗？',
          okText: '确认记录',
          icon: '💊',
        });
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'vitamin', start_time: nowLocalISO() }),
        });
        fetchEvents();
        fetchSummary();
      } catch (e) { /* user cancelled */ }
    }

    async function confirmDelete(event) {
      try {
        await askConfirm({
          title: '删除这条记录？',
          desc: '删除后无法恢复',
          okText: '删除',
          icon: '🗑️',
        });
        await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
        fetchEvents();
        fetchSummary();
      } catch (e) { /* user cancelled */ }
    }

    function saveBabyName() {
      const name = babyNameInput.value.trim() || '鱼宝';
      babyName.value = name;
      localStorage.setItem('babytrack:babyName', name);
      document.title = `${name} · BabyTrack`;
      showNameEdit.value = false;
    }

    function saveOnboarding() {
      const name = onboardingName.value.trim();
      const birth = onboardingBirth.value.trim();
      if (!name) { onboardingError.value = '请输入宝宝昵称'; return; }
      if (!birth) { onboardingError.value = '请选择出生日期'; return; }
      babyName.value = name;
      babyBirthDate.value = birth;
      localStorage.setItem('babytrack:babyName', name);
      localStorage.setItem('babytrack:babyBirth', birth);
      document.title = `${name} · BabyTrack`;
      showOnboarding.value = false;
      selectedDate.value = localDateStr(new Date());
      nextTick(() => {
        fetchEvents();
        fetchSummary();
      });
    }

    function confirmReject() {
      if (_confirmReject) {
        _confirmReject(new Error('cancelled'));
        _confirmReject = null;
        _confirmResolve = null;
      }
      confirm.show = false;
    }

    function confirmResolve() {
      if (_confirmResolve) {
        _confirmResolve(true);
        _confirmResolve = null;
        _confirmReject = null;
      }
      confirm.show = false;
    }

    function formatDayLabel(isoDate) {
      const d = new Date(isoDate);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      return `${month}/${day} 周${weekdays[d.getDay()]}`;
    }
    
    function formatDayLabelShort(isoDate) {
      const d = new Date(isoDate);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      return `${month}/${day}`;
    }
    
    function initCharts() {
      if (sleepChart) sleepChart.destroy();
      if (feedChart) feedChart.destroy();
      if (diaperChart) diaperChart.destroy();
      if (tempChart) tempChart.destroy();
      
      if (sleepChartRef.value) {
        sleepChart = new Chart(sleepChartRef.value, {
          type: 'line',
          data: { labels: [], datasets: [{ label: '睡眠(小时)', data: [], borderColor: '#7eb8e0', backgroundColor: 'rgba(126, 184, 224, 0.1)', fill: true, tension: 0.3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
      }
      
      if (feedChartRef.value) {
        feedChart = new Chart(feedChartRef.value, {
          type: 'bar',
          data: { labels: [], datasets: [{ label: '喂奶(ml)', data: [], backgroundColor: 'rgba(232, 124, 158, 0.7)' }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
      }
      
      if (diaperChartRef.value) {
        diaperChart = new Chart(diaperChartRef.value, {
          type: 'line',
          data: { labels: [], datasets: [{ label: '尿布次数', data: [], borderColor: '#a0d4a0', backgroundColor: 'rgba(160, 212, 160, 0.1)', fill: true, tension: 0.3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
      }
      
      if (tempChartRef.value) {
        tempChart = new Chart(tempChartRef.value, {
          type: 'line',
          data: { labels: [], datasets: [{ label: '体温(°C)', data: [], borderColor: '#e06060', backgroundColor: 'rgba(224, 96, 96, 0.1)', fill: true, tension: 0.3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 36, max: 38 } } }
        });
      }
    }
    
    async function fetchStatsData() {
      let url;
      const now = new Date();
      if (statsPeriod.value === 'week') {
        url = `/api/summary/week/${localDateStr(now)}`;
      } else {
        url = `/api/summary/month/${now.getFullYear()}/${now.getMonth() + 1}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      updateCharts(data);
    }
    
    function updateCharts(data) {
      const labels = [];
      const sleepData = [];
      const feedData = [];
      const diaperData = [];
      const tempData = [];
      
      const sortedDays = Object.keys(data.daily).sort();
      const labelFormat = statsPeriod.value === 'week' ? formatDayLabel : formatDayLabelShort;
      
      sortedDays.forEach(day => {
        const dayData = data.daily[day];
        labels.push(labelFormat(day));
        sleepData.push(dayData.sleep.total_minutes / 60);
        feedData.push(dayData.feed.total_ml);
        diaperData.push(dayData.diaper.count);
        
        if (statsPeriod.value === 'week' && dayData.temperature.values.length > 0) {
          const avg = dayData.temperature.values.reduce((a, b) => a + b, 0) / dayData.temperature.values.length;
          tempData.push(avg);
        } else if (statsPeriod.value === 'month' && dayData.temperature.avg !== null) {
          tempData.push(dayData.temperature.avg);
        } else {
          tempData.push(null);
        }
      });
      
      if (sleepChart) {
        sleepChart.data.labels = labels;
        sleepChart.data.datasets[0].data = sleepData;
        sleepChart.update();
      }
      
      if (feedChart) {
        feedChart.data.labels = labels;
        feedChart.data.datasets[0].data = feedData;
        feedChart.update();
      }
      
      if (diaperChart) {
        diaperChart.data.labels = labels;
        diaperChart.data.datasets[0].data = diaperData;
        diaperChart.update();
      }
      
      if (tempChart) {
        tempChart.data.labels = labels;
        tempChart.data.datasets[0].data = tempData;
        tempChart.update();
      }
    }

    onMounted(() => {
      if (!showOnboarding.value) {
        document.title = `${babyName.value} · BabyTrack`;
        fetchEvents();
        fetchSummary();
      }
      setInterval(() => {
        events.value = [...events.value];
      }, 60000);
    });
    
    watch(currentView, (newVal) => {
      if (newVal === 'stats') {
        nextTick(() => {
          initCharts();
          fetchStatsData();
        });
      }
    });
    
    watch(statsPeriod, () => {
      if (currentView.value === 'stats') {
        fetchStatsData();
      }
    });

    return {
      babyName, babyBirthDate, showOnboarding,
      onboardingName, onboardingBirth, onboardingError,
      showNameEdit, babyNameInput, selectedDate,
      events, summary, modal, showMorePanel, showEndPicker,
      currentView, statsPeriod,
      sleepChartRef, feedChartRef, diaperChartRef, tempChartRef,
      form, confirm,
      todayStr, weekDates, canGoPrev, canGoNext,
      monthDayLabel, datePickerMin, datePickerMax,
      tempDisplay, modalTitle, submitLabel,
      quickAmounts, diaperColors,
      formatTime, timeAgo, typeColor, typeLabel,
      isOngoing, ongoingLabel, eventDetail, formatDateTime,
      selectDate, goToday, goPrevWeek, goNextWeek, jumpDate,
      openModal, openEdit, closeModal, submitForm,
      handleSleep, handleBath, endOngoing, handleVitamin,
      confirmDelete, saveBabyName, saveOnboarding,
      confirmReject, confirmResolve,
    };
  },
};

createApp(App).mount('#app');
