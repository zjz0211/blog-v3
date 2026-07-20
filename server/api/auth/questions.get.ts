// 问题库（从 问题.txt 解析）
interface Question {
  id: number
  text: string
  answers: string[]
}

const QUESTIONS: Question[] = [
  { id: 1, text: '博主的真实姓名叫什么？', answers: ['张锦洲'] },
  { id: 2, text: '博主的网安引路人是谁？', answers: ['刘颖'] },
  { id: 3, text: '博主暗恋对象叫什么？', answers: ['熊瑛1'] },
  { id: 4, text: '博主的无畏契约的昵称叫什么？', answers: ['看我雄姿英发', '你的暗恋男友'] },
  { id: 5, text: '博主的生日是哪一天？', answers: ['0211'] },
  { id: 6, text: '博主在哪个高中毕业？', answers: ['安徽省无为第一中学'] },
  { id: 7, text: '博主在那所初中毕业？', answers: ['鹤毛初级中学'] },
  { id: 8, text: '博主就读于那所大学？', answers: ['滁州学院'] },
  { id: 9, text: '博主的团队名称叫什么？', answers: ['青岑'] },
  { id: 10, text: '博主的网安学习搭子叫什么(校内)？', answers: ['方志伟', '李尔冉'] },
  { id: 11, text: '博主最讨厌的人是谁？', answers: ['张锦洲'] },
]

// 随机抽取 n 个问题（不包含答案）
export default defineEventHandler(() => {
  const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, 2).map(q => ({
    id: q.id,
    text: q.text,
  }))
  return selected
})
