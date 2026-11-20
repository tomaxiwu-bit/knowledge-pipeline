// 服务层统一入口
// 导入所有适配器以触发自注册，外部代码统一从此处导入

import './freshrss'
import './karakeep'
import './memos'
import './ai'

export { freshRSSClient } from './freshrss'
export { karakeepClient } from './karakeep'
export { memosClient } from './memos'

export * from './types'
export * from './registry'
