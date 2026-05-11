// Demo data showcasing a partially-completed tidying journey,
// so a friend opening the app can immediately see what it does.

const DAY = 24 * 60 * 60 * 1000

export function getDemoState(lang = 'zh') {
  const now = Date.now()
  const data = lang === 'en' ? EN : ZH
  return {
    vision: {
      ideal: data.vision.ideal,
      atmosphere: data.vision.atmosphere,
      timeFor: data.vision.timeFor,
      images: [],
      updatedAt: now - 5 * DAY
    },
    ritualsDone: { clothes: true, books: true, papers: true },
    activeCategory: null,
    items: data.items.map((it, idx) => ({
      id: `demo-${idx}`,
      category: it.category,
      name: it.name,
      note: it.note || '',
      photo: '',
      status: it.status,
      place: it.place || '',
      createdAt: now - (data.items.length - idx) * 3600 * 1000,
      decidedAt: it.status === 'pending' ? null : now - (data.items.length - idx) * 1800 * 1000
    }))
  }
}

const ZH = {
  vision: {
    ideal: '在洒满阳光的房间里慢慢喝早茶，桌面只有一束花和一本正在读的书',
    atmosphere: '清爽、温暖、留白，每件物品都有它的家',
    timeFor: '读书、和朋友散步、画画、做一顿好饭'
  },
  items: [
    // Clothes — done
    { category: 'clothes', name: '白色棉质衬衫', note: '穿了三年，手感越来越柔软', status: 'kept', place: '衣柜第一层' },
    { category: 'clothes', name: '蓝色牛仔裤', note: '版型合身', status: 'kept', place: '衣柜抽屉，竖立折叠' },
    { category: 'clothes', name: '黑色派对裙', note: '只穿过一次，留着"以防万一"', status: 'released' },
    { category: 'clothes', name: '旧毛衣', note: '起球严重', status: 'released' },
    { category: 'clothes', name: '羊绒围巾', note: '冬天最爱', status: 'kept', place: '衣柜上方收纳盒' },
    // Books — done
    { category: 'books', name: '《怦然心动的人生整理魔法》', note: '反复读，做笔记', status: 'kept', place: '床头书架' },
    { category: 'books', name: '大学时的教科书', note: '十年没翻过', status: 'released' },
    { category: 'books', name: '《小王子》', note: '从小读到大', status: 'kept', place: '客厅书架第二层' },
    // Papers — done
    { category: 'papers', name: '过期的电费单', status: 'released' },
    { category: 'papers', name: '房屋租赁合同', note: '必须永久保存', status: 'kept', place: '文件盒 A' },
    // Komono — in progress
    { category: 'komono', name: '充电线 ×5（三根坏的）', status: 'pending' },
    { category: 'komono', name: '过期化妆品', status: 'pending' },
    { category: 'komono', name: '陶瓷马克杯', note: '每天用', status: 'kept', place: '厨房挂钩' },
    // Sentimental — untouched
    { category: 'sentimental', name: '高中毕业纪念册', status: 'pending' }
  ]
}

const EN = {
  vision: {
    ideal: 'Slow mornings drinking tea in a sunlit room, with just a flower and the book I am reading on the table',
    atmosphere: 'Airy, warm, spacious — every item has its home',
    timeFor: 'Reading, walking with friends, painting, cooking a real meal'
  },
  items: [
    { category: 'clothes', name: 'White cotton shirt', note: 'Three years old, softer every wash', status: 'kept', place: 'Closet, top shelf' },
    { category: 'clothes', name: 'Blue jeans', note: 'Perfect fit', status: 'kept', place: 'Drawer, folded upright' },
    { category: 'clothes', name: 'Black party dress', note: 'Worn once, kept "just in case"', status: 'released' },
    { category: 'clothes', name: 'Old sweater', note: 'Pilled badly', status: 'released' },
    { category: 'clothes', name: 'Cashmere scarf', note: 'Winter favorite', status: 'kept', place: 'Storage box, top of closet' },
    { category: 'books', name: '"The Life-Changing Magic of Tidying Up"', note: 'Re-read with notes', status: 'kept', place: 'Bedside shelf' },
    { category: 'books', name: 'College textbooks', note: "Haven't opened in 10 years", status: 'released' },
    { category: 'books', name: '"The Little Prince"', note: 'A lifelong companion', status: 'kept', place: 'Living room shelf, row 2' },
    { category: 'papers', name: 'Old electricity bills', status: 'released' },
    { category: 'papers', name: 'Lease agreement', note: 'Must keep permanently', status: 'kept', place: 'Folder A' },
    { category: 'komono', name: 'Charging cables × 5 (3 broken)', status: 'pending' },
    { category: 'komono', name: 'Expired cosmetics', status: 'pending' },
    { category: 'komono', name: 'Ceramic mug', note: 'Daily use', status: 'kept', place: 'Kitchen hook' },
    { category: 'sentimental', name: 'High school yearbook', status: 'pending' }
  ]
}
