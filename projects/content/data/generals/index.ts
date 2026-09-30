import caoCaoWei from './wei/cao-cao.json';
import guoJiaWei from './wei/guo-jia.json';
import simaYiWei from './wei/sima-yi.json';
import xiahouDunWei from './wei/xiahou-dun.json';
import xuChuWei from './wei/xu-chu.json';
import zhangLiaoWei from './wei/zhang-liao.json';
import zhenJiWei from './wei/zhen-ji.json';
import guanYuShu from './shu/guan-yu.json';
import huangYueyingShu from './shu/huang-yueying.json';
import liuBeiShu from './shu/liu-bei.json';
import maChaoShu from './shu/ma-chao.json';
import zhangFeiShu from './shu/zhang-fei.json';
import zhaoYunShu from './shu/zhao-yun.json';
import zhugeLiangShu from './shu/zhuge-liang.json';
import daQiaoWu from './wu/da-qiao.json';
import ganNingWu from './wu/gan-ning.json';
import huangGaiWu from './wu/huang-gai.json';
import luMengWu from './wu/lu-meng.json';
import luXunWu from './wu/lu-xun.json';
import sunQuanWu from './wu/sun-quan.json';
import sunShangxiangWu from './wu/sun-shangxiang.json';
import zhouYuWu from './wu/zhou-yu.json';
import diaoChanQun from './qun/diao-chan.json';
import huaTuoQun from './qun/hua-tuo.json';
import luBuQun from './qun/lu-bu.json';
import dongZhuoQun from './qun/dong-zhuo.json';

export interface GeneralSkillData {
  name: string;
  nameZh: string;
  text: string;
}

export interface GeneralFileData {
  name: string;
  nameZh?: string;
  title?: string;
  titleZh?: string;
  maxHp: number | null;
  skills: GeneralSkillData[];
  source: { url: string; site: string; crawledAt: string };
}

export interface GeneralData extends GeneralFileData {
  kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun';
}

export const generalsData: Record<string, GeneralData> = {
  'cao-cao': { ...(caoCaoWei as GeneralFileData), kingdom: 'Wei' },
  'guo-jia': { ...(guoJiaWei as GeneralFileData), kingdom: 'Wei' },
  'sima-yi': { ...(simaYiWei as GeneralFileData), kingdom: 'Wei' },
  'xiahou-dun': { ...(xiahouDunWei as GeneralFileData), kingdom: 'Wei' },
  'xu-chu': { ...(xuChuWei as GeneralFileData), kingdom: 'Wei' },
  'zhang-liao': { ...(zhangLiaoWei as GeneralFileData), kingdom: 'Wei' },
  'zhen-ji': { ...(zhenJiWei as GeneralFileData), kingdom: 'Wei' },
  'guan-yu': { ...(guanYuShu as GeneralFileData), kingdom: 'Shu' },
  'huang-yueying': { ...(huangYueyingShu as GeneralFileData), kingdom: 'Shu' },
  'liu-bei': { ...(liuBeiShu as GeneralFileData), kingdom: 'Shu' },
  'ma-chao': { ...(maChaoShu as GeneralFileData), kingdom: 'Shu' },
  'zhang-fei': { ...(zhangFeiShu as GeneralFileData), kingdom: 'Shu' },
  'zhao-yun': { ...(zhaoYunShu as GeneralFileData), kingdom: 'Shu' },
  'zhuge-liang': { ...(zhugeLiangShu as GeneralFileData), kingdom: 'Shu' },
  'da-qiao': { ...(daQiaoWu as GeneralFileData), kingdom: 'Wu' },
  'gan-ning': { ...(ganNingWu as GeneralFileData), kingdom: 'Wu' },
  'huang-gai': { ...(huangGaiWu as GeneralFileData), kingdom: 'Wu' },
  'lu-meng': { ...(luMengWu as GeneralFileData), kingdom: 'Wu' },
  'lu-xun': { ...(luXunWu as GeneralFileData), kingdom: 'Wu' },
  'sun-quan': { ...(sunQuanWu as GeneralFileData), kingdom: 'Wu' },
  'sun-shangxiang': { ...(sunShangxiangWu as GeneralFileData), kingdom: 'Wu' },
  'zhou-yu': { ...(zhouYuWu as GeneralFileData), kingdom: 'Wu' },
  'diao-chan': { ...(diaoChanQun as GeneralFileData), kingdom: 'Qun' },
  'hua-tuo': { ...(huaTuoQun as GeneralFileData), kingdom: 'Qun' },
  'lu-bu': { ...(luBuQun as GeneralFileData), kingdom: 'Qun' },
  'dong-zhuo': { ...(dongZhuoQun as GeneralFileData), kingdom: 'Qun' },
};
