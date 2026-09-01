// 「加入歌单」通用流程：拉我的歌单 → action sheet 选择 → 加歌
// home / square / playlist 页共用；调用方需先做登录校验
import { api } from '../services/api'

export async function pickPlaylist(song: { id: number }): Promise<void> {
  const my = await api.myPlaylists()
  const created = (my && my.created) || []
  if (!created.length) {
    wx.showToast({ title: '还没有歌单，去「音乐库」创建', icon: 'none' })
    return
  }
  const names = created.slice(0, 6).map((p: any) => p.name) // action sheet 上限 6 项
  wx.showActionSheet({
    itemList: names,
    success: async (res: IAnyObject) => {
      const pl = created[res.tapIndex]
      try {
        await api.addPlaylistSong(pl.id, song.id)
        wx.showToast({ title: '已加入「' + pl.name + '」', icon: 'none' })
      } catch (e) {
        /* api 层已提示（重复添加等） */
      }
    },
    fail: () => {}
  })
}
