import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setApiLanguage } from './api/client'

export type Lang = 'uz' | 'ru'
const LANG_KEY = 'shop.lang'

// Uzbek (Latin) uses ‘ for oʻ/gʻ. Values may contain {placeholders}.
const messages = {
  appName: { uz: 'Poyabzal ombori', ru: 'Обувной склад' },
  navHome: { uz: 'Bosh sahifa', ru: 'Главная' },
  navStock: { uz: 'Ombor', ru: 'Склад' },
  navScan: { uz: 'Skaner', ru: 'Скан' },
  navLabels: { uz: 'Yorliqlar', ru: 'Этикетки' },
  navStats: { uz: 'Hisobot', ru: 'Отчёт' },
  mainMenu: { uz: 'Asosiy menyu', ru: 'Главное меню' },
  logOut: { uz: 'Chiqish', ru: 'Выйти' },
  language: { uz: 'Til', ru: 'Язык' },
  som: { uz: 'so‘m', ru: 'сум' },
  loading: { uz: 'Yuklanmoqda…', ru: 'Загрузка…' },
  networkError: {
    uz: 'Server bilan bog‘lanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.',
    ru: 'Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.',
  },
  retry: { uz: 'Qayta urinish', ru: 'Повторить' },
  back: { uz: 'Orqaga', ru: 'Назад' },
  size: { uz: 'O‘lcham', ru: 'Размер' },

  loginTitle: { uz: 'Do‘koningizga kiring', ru: 'Вход в магазин' },
  username: { uz: 'Login', ru: 'Логин' },
  password: { uz: 'Parol', ru: 'Пароль' },
  logIn: { uz: 'Kirish', ru: 'Войти' },
  loggingIn: { uz: 'Kirilmoqda…', ru: 'Входим…' },
  badLogin: {
    uz: 'Login yoki parol noto‘g‘ri. Klaviatura tilini tekshirib, qayta kiriting.',
    ru: 'Неверный логин или пароль. Проверьте раскладку клавиатуры и попробуйте снова.',
  },
  tooManyAttempts: {
    uz: 'Juda ko‘p urinish bo‘ldi. Bir daqiqadan so‘ng qayta urinib ko‘ring.',
    ru: 'Слишком много попыток. Попробуйте снова через минуту.',
  },

  pairsOnShelf: { uz: 'Javondagi juftlar', ru: 'Пар на полках' },
  worthAtCost: { uz: 'Tannarx bo‘yicha', ru: 'По закупке' },
  searchPlaceholder: { uz: 'Brend yoki kod', ru: 'Бренд или код' },
  filters: { uz: 'Filtrlar', ru: 'Фильтры' },
  sort: { uz: 'Tartib', ru: 'Сортировка' },
  addedFrom: { uz: 'Qo‘shilgan: dan', ru: 'Добавлено с' },
  addedTo: { uz: 'Qo‘shilgan: gacha', ru: 'Добавлено по' },
  inStock: { uz: 'Bor', ru: 'В наличии' },
  soldOut: { uz: 'Tugagan', ru: 'Нет в наличии' },
  all: { uz: 'Hammasi', ru: 'Все' },
  newestFirst: { uz: 'Avval yangilari', ru: 'Сначала новые' },
  oldestFirst: { uz: 'Avval eskilari', ru: 'Сначала старые' },
  mostPairs: { uz: 'Ko‘p qolganlar', ru: 'Больше остаток' },
  fewestPairs: { uz: 'Kam qolganlar', ru: 'Меньше остаток' },
  highestPrice: { uz: 'Qimmatlari', ru: 'Дороже' },
  lowestPrice: { uz: 'Arzonlari', ru: 'Дешевле' },
  clearFilters: { uz: 'Filtrlarni tozalash', ru: 'Сбросить фильтры' },
  nothingMatches: { uz: 'Hech narsa topilmadi', ru: 'Ничего не найдено' },
  nothingMatchesHint: {
    uz: 'Boshqa brend yoki o‘lchamni sinab ko‘ring yoki filtrlarni tozalang.',
    ru: 'Попробуйте другой бренд или размер либо сбросьте фильтры.',
  },
  emptyTitle: { uz: 'Javon hali bo‘sh', ru: 'На полках пока пусто' },
  emptyHint: {
    uz: 'Birinchi kelgan tovarni kiriting: brend, bir juftning narxi va har bir o‘lchamdan nechta. Har bir o‘lcham o‘z shtrix-kodini oladi.',
    ru: 'Добавьте первую поставку: бренд, цену за пару и количество каждого размера. Каждый размер получит свой штрихкод.',
  },
  addStock: { uz: 'Tovar qo‘shish', ru: 'Добавить товар' },
  showMore: { uz: 'Yana ko‘rsatish', ru: 'Показать ещё' },

  addSubtitle: {
    uz: 'Bitta brend, bitta narx. Har bir o‘lcham va nechta juft kelganini kiriting.',
    ru: 'Один бренд по одной цене. Укажите каждый размер и сколько пар пришло.',
  },
  brand: { uz: 'Brend', ru: 'Бренд' },
  boughtPrice: { uz: 'Bir juftning kelish narxi', ru: 'Закупочная цена за пару' },
  priceHint: {
    uz: 'Shu model yangi narxda kelsa, alohida shtrix-kod oladi, shunda foyda aniq hisoblanadi.',
    ru: 'Та же модель по новой цене получит отдельный штрихкод, чтобы прибыль считалась точно.',
  },
  sizes: { uz: 'O‘lchamlar', ru: 'Размеры' },
  pairsColumn: { uz: 'Juft', ru: 'Пар' },
  addSize: { uz: 'Yana o‘lcham', ru: 'Ещё размер' },
  removeSize: { uz: 'O‘lchamni olib tashlash', ru: 'Убрать размер' },
  photo: { uz: 'Rasm', ru: 'Фото' },
  optional: { uz: 'ixtiyoriy', ru: 'необязательно' },
  takePhoto: { uz: 'Rasmga olish', ru: 'Сфотографировать' },
  retakePhoto: { uz: 'Qayta olish', ru: 'Переснять' },
  choosePhoto: { uz: 'Galereyadan tanlash', ru: 'Выбрать из галереи' },
  removePhoto: { uz: 'Rasmni olib tashlash', ru: 'Убрать фото' },
  photoHint: { uz: 'Keyin modelni tanib olishga yordam beradi', ru: 'Поможет потом узнать модель' },
  saveStock: { uz: 'Saqlash va shtrix-kod yaratish', ru: 'Сохранить и создать штрихкоды' },
  saving: { uz: 'Saqlanmoqda…', ru: 'Сохраняем…' },
  enterBrand: { uz: 'Brendni kiriting', ru: 'Введите бренд' },
  enterPrice: { uz: 'Bir juft uchun to‘langan narxni kiriting', ru: 'Введите цену, которую заплатили за пару' },
  needSizes: { uz: 'Kamida bitta o‘lcham va juftlar sonini kiriting.', ru: 'Добавьте хотя бы один размер и количество пар.' },
  whichSize: { uz: 'Qaysi o‘lcham?', ru: 'Какой размер?' },
  howManyPairs: { uz: 'Nechta juft?', ru: 'Сколько пар?' },
  sizeFormat: { uz: '41 yoki 41.5 kabi kiriting', ru: 'Введите как 41 или 41.5' },

  addedTitle: { uz: 'Omborga qo‘shildi', ru: 'Добавлено на склад' },
  newCode: { uz: 'Yangi shtrix-kod', ru: 'Новый штрихкод' },
  toppedUp: { uz: 'Mavjud qatorga qo‘shildi, kod o‘sha', ru: 'Добавлено к имеющимся, код тот же' },
  printLabelsCount: { uz: '{n} ta yorliq chiqarish', ru: 'Создать этикетки: {n}' },
  addMoreStock: { uz: 'Yana tovar qo‘shish', ru: 'Добавить ещё товар' },

  boughtFor: { uz: 'Kelish narxi {price}', ru: 'Закупка {price}' },
  left: { uz: 'qoldi', ru: 'осталось' },
  sizesCount: { uz: '{n} ta o‘lcham', ru: 'Размеров: {n}' },
  sellOne: { uz: 'Bittasini sotish', ru: 'Продать одну пару' },
  downloadLabel: { uz: 'Yorliq (PNG)', ru: 'Этикетка (PNG)' },
  findSimilar: { uz: 'Shu brend', ru: 'Этот бренд' },
  addedOn: { uz: 'Qo‘shilgan', ru: 'Добавлено' },
  soldCount: { uz: 'Sotilgan', ru: 'Продано' },
  receivedCount: { uz: 'Kelgan', ru: 'Поступило' },
  sales: { uz: 'Sotuvlar', ru: 'Продажи' },
  noSalesYet: { uz: 'Hali sotilmagan', ru: 'Продаж пока нет' },
  profit: { uz: '+{amount} foyda', ru: '+{amount} прибыль' },
  loss: { uz: '−{amount} zarar', ru: '−{amount} убыток' },
  codeNotFound: { uz: 'Bunday kod topilmadi', ru: 'Код не найден' },
  codeNotFoundHint: {
    uz: '{code} kodi omborda yo‘q. Kodni qayta tekshiring yoki brend bo‘yicha qidiring.',
    ru: 'Кода {code} нет на складе. Проверьте код или найдите товар по бренду.',
  },
  scanAgain: { uz: 'Qayta skanerlash', ru: 'Сканировать снова' },
  searchStock: { uz: 'Ombordan qidirish', ru: 'Искать на складе' },
  soldToast: { uz: 'Sotildi. {size} o‘lchamdan {left} juft qoldi.', ru: 'Продано. Размер {size}: осталось {left}.' },

  editProduct: { uz: 'Tahrirlash', ru: 'Изменить' },
  editTitle: { uz: 'Mahsulotni tahrirlash', ru: 'Изменить товар' },
  pairsLeft: { uz: 'Qolgan juftlar', ru: 'Осталось пар' },
  pairsLeftHint: { uz: 'Yo‘qolgan yoki noto‘g‘ri sanalgan juftlar uchun. Sotuv sifatida hisoblanmaydi.', ru: 'Для потерянных или неверно посчитанных пар. Продажей не считается.' },
  deliveryShared: {
    uz: 'Brend, narx va rasm shu partiyaning barcha o‘lchamlari uchun o‘zgaradi ({n} ta).',
    ru: 'Бренд, цена и фото изменятся для всех размеров этой поставки ({n}).',
  },
  priceFixHint: { uz: 'O‘tgan sotuvlar foydasi ham qayta hisoblanadi.', ru: 'Прибыль прошлых продаж тоже пересчитается.' },
  relabelHint: { uz: 'O‘lcham yoki brend o‘zgarsa, yangi yorliq chiqaring.', ru: 'Если меняете размер или бренд, распечатайте новую этикетку.' },
  saveChanges: { uz: 'O‘zgarishlarni saqlash', ru: 'Сохранить изменения' },
  savedToast: { uz: 'O‘zgarishlar saqlandi', ru: 'Изменения сохранены' },
  deleteProduct: { uz: 'Mahsulotni o‘chirish', ru: 'Удалить товар' },
  deleteConfirm: {
    uz: '{brand}, {size} o‘lcham butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi.',
    ru: '{brand}, размер {size} будет удалён навсегда. Это нельзя отменить.',
  },
  deleteYes: { uz: 'Ha, o‘chirish', ru: 'Да, удалить' },
  cancel: { uz: 'Bekor qilish', ru: 'Отмена' },
  sizeTaken: { uz: 'Bu partiyada shu o‘lcham bor', ru: 'В этой поставке уже есть такой размер' },
  deleting: { uz: 'O‘chirilmoqda…', ru: 'Удаляем…' },
  deletedToast: { uz: 'Mahsulot o‘chirildi', ru: 'Товар удалён' },
  cantDeleteSold: {
    uz: 'Bu mahsulot sotilgan, shuning uchun o‘chirib bo‘lmaydi — hisobotlar buzilib ketadi. Sotuvdan olish uchun qolgan juftlarni 0 qiling.',
    ru: 'У товара есть продажи, поэтому удалить его нельзя — сломаются отчёты. Чтобы убрать его из продажи, поставьте 0 пар.',
  },

  sellTitle: { uz: 'Sotish', ru: 'Продажа' },
  soldFor: { uz: 'Qanchaga sotdingiz?', ru: 'За сколько продали?' },
  lastSoldFor: { uz: 'Oxirgi narx', ru: 'Прошлая цена' },
  cost: { uz: 'Tannarx', ru: 'Закупка' },
  saveSale: { uz: 'Sotuvni saqlash', ru: 'Сохранить продажу' },
  priceTooHigh: { uz: 'Narx juda katta. Nollarni tekshiring.', ru: 'Слишком большая цена. Проверьте нули.' },
  enterSoldPrice: { uz: 'Sotilgan narxni kiriting', ru: 'Введите цену продажи' },

  scanTitle: { uz: 'Skanerlash', ru: 'Сканирование' },
  startCamera: { uz: 'Kamerani yoqish', ru: 'Включить камеру' },
  cameraIntro: { uz: 'Yorliqdagi shtrix-kodni ramka ichiga to‘g‘rilang.', ru: 'Наведите рамку на штрихкод на этикетке.' },
  cameraStarting: { uz: 'Kamera yoqilmoqda…', ru: 'Включаем камеру…' },
  cameraAim: { uz: 'Shtrix-kodni ramkaga to‘g‘rilang', ru: 'Наведите на штрихкод' },
  cameraFound: { uz: 'Topildi', ru: 'Найдено' },
  cameraDenied: {
    uz: 'Kameraga ruxsat berilmagan. Brauzer sozlamalarida ruxsat bering yoki kodni qo‘lda kiriting.',
    ru: 'Нет доступа к камере. Разрешите его в настройках браузера или введите код вручную.',
  },
  cameraInsecure: {
    uz: 'Kamera faqat https manzilda ishlaydi. Hozircha kodni qo‘lda kiriting.',
    ru: 'Камера работает только по адресу https. Пока введите код вручную.',
  },
  cameraFailed: { uz: 'Kamera ishga tushmadi. Kodni qo‘lda kiriting.', ru: 'Камера не запустилась. Введите код вручную.' },
  typeCode: { uz: 'Yoki kodni qo‘lda kiriting', ru: 'Или введите код вручную' },
  codeExample: { uz: 'Masalan, K7XQ2M9PHD', ru: 'Например, K7XQ2M9PHD' },
  open: { uz: 'Ochish', ru: 'Открыть' },

  labelsIntro: {
    uz: 'Belgilangan qatorlar uchun A4 varaqda 60×30 mm yorliqlar tayyorlanadi. Odatda har bir juftga bittadan.',
    ru: 'Для отмеченных строк будет лист A4 с этикетками 60×30 мм. Обычно по одной на каждую пару.',
  },
  notPrinted: { uz: 'Chop etilmaganlar', ru: 'Не напечатанные' },
  allInStock: { uz: 'Bor tovarlar', ru: 'Всё в наличии' },
  selectAll: { uz: 'Hammasini belgilash', ru: 'Выбрать все' },
  copies: { uz: 'nusxa', ru: 'копий' },
  labelsCount: { uz: '{n} ta yorliq', ru: 'Этикеток: {n}' },
  tooManyLabels: { uz: 'Bir PDF’da ko‘pi bilan {max} ta yorliq. Nusxalarni kamaytiring.', ru: 'Не больше {max} этикеток в одном PDF. Уменьшите число копий.' },
  makeLabels: { uz: 'PDF yaratish: {n} ta yorliq', ru: 'Создать PDF: {n} этикеток' },
  preparing: { uz: 'Tayyorlanmoqda…', ru: 'Готовим…' },
  allPrinted: { uz: 'Hamma yorliqlar chop etilgan', ru: 'Все этикетки напечатаны' },
  allPrintedHint: {
    uz: 'Yangi tovar qo‘shganingizda uning yorliqlari shu yerda chiqadi.',
    ru: 'Когда добавите товар, его этикетки появятся здесь.',
  },

  statsTitle: { uz: 'Hisobot', ru: 'Отчёт' },
  daily: { uz: 'Kunlik', ru: 'За день' },
  days7: { uz: '7 kun', ru: '7 дней' },
  days30: { uz: '30 kun', ru: '30 дней' },
  from: { uz: 'Dan', ru: 'С' },
  to: { uz: 'Gacha', ru: 'По' },
  show: { uz: 'Ko‘rsatish', ru: 'Показать' },
  profitForPeriod: { uz: 'Shu davrdagi foyda', ru: 'Прибыль за период' },
  revenue: { uz: 'Tushum', ru: 'Выручка' },
  pairsSold: { uz: 'Sotilgan juftlar', ru: 'Продано пар' },
  stockAtCost: { uz: 'Ombor, tannarxda', ru: 'Склад по закупке' },
  salesOverTime: { uz: 'Sotuvlar dinamikasi', ru: 'Продажи по времени' },
  profitKey: { uz: 'Foyda', ru: 'Прибыль' },
  tapBar: { uz: 'Raqamlarni ko‘rish uchun ustunni bosing', ru: 'Нажмите на столбец, чтобы увидеть цифры' },
  bestBrands: { uz: 'Eng ko‘p sotilgan brendlar', ru: 'Самые продаваемые бренды' },
  bestSizes: { uz: 'Eng ko‘p sotilgan o‘lchamlar', ru: 'Самые ходовые размеры' },
  noSalesInPeriod: { uz: 'Bu davrda sotuv bo‘lmagan', ru: 'За этот период продаж не было' },
  slowTitle: { uz: 'Turib qolgan tovar', ru: 'Залежавшийся товар' },
  unsoldForDays: { uz: 'Necha kundan beri sotilmagan', ru: 'Сколько дней без продаж' },
  slowNone: {
    uz: '{n} kundan ortiq sotilmay turgan tovar yo‘q.',
    ru: 'Нет товара, который не продавался больше {n} дн.',
  },
  downloadData: { uz: 'Ma’lumotlarni yuklab olish', ru: 'Выгрузить данные' },

  dailyReports: { uz: 'Kunlik hisobotlar', ru: 'Отчёты по дням' },
  dailyReport: { uz: 'Kunlik hisobot', ru: 'Отчёт за день' },
  today: { uz: 'Bugun', ru: 'Сегодня' },
  paymentType: { uz: 'To‘lov turi', ru: 'Способ оплаты' },
  cash: { uz: 'Naqd', ru: 'Наличные' },
  card: { uz: 'Karta', ru: 'Карта' },
  groupSales: { uz: 'Sotuv', ru: 'Продажи' },
  groupPayment: { uz: 'To‘lov', ru: 'Оплата' },
  cashToCount: { uz: 'Kassada bo‘lishi kerak', ru: 'Должно быть в кассе' },
  todayProfit: { uz: 'Bugungi foyda', ru: 'Прибыль за сегодня' },
  todayReport: { uz: 'Bugungi hisobot', ru: 'Отчёт за сегодня' },
  runningLow: { uz: 'Kam qolgan', ru: 'Заканчивается' },
  nothingRunningLow: { uz: 'Hamma o‘lchamlardan yetarli bor.', ru: 'Всех размеров хватает.' },
  yesterday: { uz: 'Kecha', ru: 'Вчера' },
  previousDay: { uz: 'Oldingi kun', ru: 'Предыдущий день' },
  nextDay: { uz: 'Keyingi kun', ru: 'Следующий день' },
  profitForDay: { uz: 'Kunlik foyda', ru: 'Прибыль за день' },
  received: { uz: 'Kelgan tovar', ru: 'Поступление' },
  receivedPairs: { uz: 'Kelgan juftlar', ru: 'Поступило пар' },
  receivedValue: { uz: 'Kelgan tovar qiymati', ru: 'Сумма поступления' },
  noSalesToday: { uz: 'Bu kuni sotuv bo‘lmagan', ru: 'В этот день продаж не было' },
  nothingReceived: { uz: 'Bu kuni tovar kelmagan', ru: 'В этот день товар не поступал' },
  quietDay: { uz: 'Sotuv yo‘q', ru: 'Без продаж' },
  soldByBrand: { uz: 'Brendlar bo‘yicha', ru: 'По брендам' },
  downloadExcel: { uz: 'Excel yuklab olish', ru: 'Скачать Excel' },
  earlierDays: { uz: 'Oldingi 30 kun', ru: 'Ещё 30 дней' },
  soldPairsShort: { uz: 'sotildi', ru: 'продано' },
  receivedShort: { uz: 'keldi', ru: 'поступило' },

  exportTitle: { uz: 'Yuklab olish', ru: 'Выгрузка' },
  exportInventory: { uz: 'Ombor qoldig‘i', ru: 'Остатки склада' },
  exportInventoryHint: {
    uz: 'Har bir o‘lcham: kod, brend, qoldiq, narx va qiymat.',
    ru: 'Каждый размер: код, бренд, остаток, цена и стоимость.',
  },
  exportSales: { uz: 'Sotuvlar tarixi', ru: 'История продаж' },
  exportSalesHint: {
    uz: 'Tanlangan davrdagi har bir sotuv: sana, narx va foyda.',
    ru: 'Каждая продажа за выбранный период: дата, цена и прибыль.',
  },
} satisfies Record<string, Record<Lang, string>>

export type MessageKey = keyof typeof messages

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  pairs: (n: number) => string
}

const I18nContext = createContext<I18n | null>(null)

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'uz' || saved === 'ru') return saved
  } catch {
    /* storage blocked */
  }
  return 'uz'
}

function russianPlural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  setApiLanguage(lang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = messages.appName[lang]
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* storage blocked */
    }
  }, [])

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) =>
        messages[key][lang].replace(/\{(\w+)\}/g, (_match, name: string) => String(vars?.[name] ?? `{${name}}`)),
      pairs: (n) => (lang === 'ru' ? `${n} ${russianPlural(n, 'пара', 'пары', 'пар')}` : `${n} juft`),
    }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
