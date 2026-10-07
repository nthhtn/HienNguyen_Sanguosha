import caoCaoWei from './wei/cao-cao.json';
import caoPiWei from './wei/cao-pi.json';
import caoRenWei from './wei/cao-ren.json';
import dengAiWei from './wei/deng-ai.json';
import dianWeiWei from './wei/dian-wei.json';
import guoJiaWei from './wei/guo-jia.json';
import simaYiWei from './wei/sima-yi.json';
import xiahouDunWei from './wei/xiahou-dun.json';
import xiahouYuanWei from './wei/xiahou-yuan.json';
import xuChuWei from './wei/xu-chu.json';
import xuHuangWei from './wei/xu-huang.json';
import xunYuWei from './wei/xun-yu.json';
import zhangHeWei from './wei/zhang-he.json';
import zhangLiaoWei from './wei/zhang-liao.json';
import zhenJiWei from './wei/zhen-ji.json';
import fireZhugeLiangShu from './shu/fire-zhuge-liang.json';
import guanYuShu from './shu/guan-yu.json';
import huangYueyingShu from './shu/huang-yueying.json';
import huangZhongShu from './shu/huang-zhong.json';
import jiangWeiShu from './shu/jiang-wei.json';
import liuBeiShu from './shu/liu-bei.json';
import liuShanShu from './shu/liu-shan.json';
import maChaoShu from './shu/ma-chao.json';
import mengHuoShu from './shu/meng-huo.json';
import pangTongShu from './shu/pang-tong.json';
import weiYanShu from './shu/wei-yan.json';
import zhangFeiShu from './shu/zhang-fei.json';
import zhaoYunShu from './shu/zhao-yun.json';
import zhuRongShu from './shu/zhu-rong.json';
import zhugeLiangShu from './shu/zhuge-liang.json';
import daQiaoWu from './wu/da-qiao.json';
import ganNingWu from './wu/gan-ning.json';
import huangGaiWu from './wu/huang-gai.json';
import luMengWu from './wu/lu-meng.json';
import luSuWu from './wu/lu-su.json';
import luXunWu from './wu/lu-xun.json';
import sunCeWu from './wu/sun-ce.json';
import sunJianWu from './wu/sun-jian.json';
import sunQuanWu from './wu/sun-quan.json';
import sunShangxiangWu from './wu/sun-shangxiang.json';
import taishiCiWu from './wu/taishi-ci.json';
import xiaoQiaoWu from './wu/xiao-qiao.json';
import zhangZhaoAndZhangHongWu from './wu/zhang-zhao-and-zhang-hong.json';
import zhouTaiWu from './wu/zhou-tai.json';
import zhouYuWu from './wu/zhou-yu.json';
import caiWenjiQun from './qun/cai-wenji.json';
import diaoChanQun from './qun/diao-chan.json';
import dongZhuoQun from './qun/dong-zhuo.json';
import huaTuoQun from './qun/hua-tuo.json';
import jiaXuQun from './qun/jia-xu.json';
import luBuQun from './qun/lu-bu.json';
import pangDeQun from './qun/pang-de.json';
import yanLiangAndWenChouQun from './qun/yan-liang-and-wen-chou.json';
import yuJiQun from './qun/yu-ji.json';
import yuanShaoQun from './qun/yuan-shao.json';
import zhangJiaoQun from './qun/zhang-jiao.json';
import zuoCiQun from './qun/zuo-ci.json';

export interface GeneralSkillData {
  name: string;
  nameZh: string;
  text: string;
  // A Lord skill ("King Ability"): not used in Kingdom War.
  lord?: boolean;
}

export interface GeneralFileData {
  name: string;
  nameZh?: string;
  title?: string;
  titleZh?: string;
  maxHp: number | null;
  gender: 'male' | 'female';
  skills: GeneralSkillData[];
  source: { url: string; site: string; crawledAt: string; expansion?: string; genderFrom?: string };
}

export interface GeneralData extends GeneralFileData {
  kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun';
}

export const generalsData: Record<string, GeneralData> = {
  'cao-cao': { ...(caoCaoWei as GeneralFileData), kingdom: 'Wei' },
  'cao-pi': { ...(caoPiWei as GeneralFileData), kingdom: 'Wei' },
  'cao-ren': { ...(caoRenWei as GeneralFileData), kingdom: 'Wei' },
  'deng-ai': { ...(dengAiWei as GeneralFileData), kingdom: 'Wei' },
  'dian-wei': { ...(dianWeiWei as GeneralFileData), kingdom: 'Wei' },
  'guo-jia': { ...(guoJiaWei as GeneralFileData), kingdom: 'Wei' },
  'sima-yi': { ...(simaYiWei as GeneralFileData), kingdom: 'Wei' },
  'xiahou-dun': { ...(xiahouDunWei as GeneralFileData), kingdom: 'Wei' },
  'xiahou-yuan': { ...(xiahouYuanWei as GeneralFileData), kingdom: 'Wei' },
  'xu-chu': { ...(xuChuWei as GeneralFileData), kingdom: 'Wei' },
  'xu-huang': { ...(xuHuangWei as GeneralFileData), kingdom: 'Wei' },
  'xun-yu': { ...(xunYuWei as GeneralFileData), kingdom: 'Wei' },
  'zhang-he': { ...(zhangHeWei as GeneralFileData), kingdom: 'Wei' },
  'zhang-liao': { ...(zhangLiaoWei as GeneralFileData), kingdom: 'Wei' },
  'zhen-ji': { ...(zhenJiWei as GeneralFileData), kingdom: 'Wei' },
  'fire-zhuge-liang': { ...(fireZhugeLiangShu as GeneralFileData), kingdom: 'Shu' },
  'guan-yu': { ...(guanYuShu as GeneralFileData), kingdom: 'Shu' },
  'huang-yueying': { ...(huangYueyingShu as GeneralFileData), kingdom: 'Shu' },
  'huang-zhong': { ...(huangZhongShu as GeneralFileData), kingdom: 'Shu' },
  'jiang-wei': { ...(jiangWeiShu as GeneralFileData), kingdom: 'Shu' },
  'liu-bei': { ...(liuBeiShu as GeneralFileData), kingdom: 'Shu' },
  'liu-shan': { ...(liuShanShu as GeneralFileData), kingdom: 'Shu' },
  'ma-chao': { ...(maChaoShu as GeneralFileData), kingdom: 'Shu' },
  'meng-huo': { ...(mengHuoShu as GeneralFileData), kingdom: 'Shu' },
  'pang-tong': { ...(pangTongShu as GeneralFileData), kingdom: 'Shu' },
  'wei-yan': { ...(weiYanShu as GeneralFileData), kingdom: 'Shu' },
  'zhang-fei': { ...(zhangFeiShu as GeneralFileData), kingdom: 'Shu' },
  'zhao-yun': { ...(zhaoYunShu as GeneralFileData), kingdom: 'Shu' },
  'zhu-rong': { ...(zhuRongShu as GeneralFileData), kingdom: 'Shu' },
  'zhuge-liang': { ...(zhugeLiangShu as GeneralFileData), kingdom: 'Shu' },
  'da-qiao': { ...(daQiaoWu as GeneralFileData), kingdom: 'Wu' },
  'gan-ning': { ...(ganNingWu as GeneralFileData), kingdom: 'Wu' },
  'huang-gai': { ...(huangGaiWu as GeneralFileData), kingdom: 'Wu' },
  'lu-meng': { ...(luMengWu as GeneralFileData), kingdom: 'Wu' },
  'lu-su': { ...(luSuWu as GeneralFileData), kingdom: 'Wu' },
  'lu-xun': { ...(luXunWu as GeneralFileData), kingdom: 'Wu' },
  'sun-ce': { ...(sunCeWu as GeneralFileData), kingdom: 'Wu' },
  'sun-jian': { ...(sunJianWu as GeneralFileData), kingdom: 'Wu' },
  'sun-quan': { ...(sunQuanWu as GeneralFileData), kingdom: 'Wu' },
  'sun-shangxiang': { ...(sunShangxiangWu as GeneralFileData), kingdom: 'Wu' },
  'taishi-ci': { ...(taishiCiWu as GeneralFileData), kingdom: 'Wu' },
  'xiao-qiao': { ...(xiaoQiaoWu as GeneralFileData), kingdom: 'Wu' },
  'zhang-zhao-and-zhang-hong': { ...(zhangZhaoAndZhangHongWu as GeneralFileData), kingdom: 'Wu' },
  'zhou-tai': { ...(zhouTaiWu as GeneralFileData), kingdom: 'Wu' },
  'zhou-yu': { ...(zhouYuWu as GeneralFileData), kingdom: 'Wu' },
  'cai-wenji': { ...(caiWenjiQun as GeneralFileData), kingdom: 'Qun' },
  'diao-chan': { ...(diaoChanQun as GeneralFileData), kingdom: 'Qun' },
  'dong-zhuo': { ...(dongZhuoQun as GeneralFileData), kingdom: 'Qun' },
  'hua-tuo': { ...(huaTuoQun as GeneralFileData), kingdom: 'Qun' },
  'jia-xu': { ...(jiaXuQun as GeneralFileData), kingdom: 'Qun' },
  'lu-bu': { ...(luBuQun as GeneralFileData), kingdom: 'Qun' },
  'pang-de': { ...(pangDeQun as GeneralFileData), kingdom: 'Qun' },
  'yan-liang-and-wen-chou': { ...(yanLiangAndWenChouQun as GeneralFileData), kingdom: 'Qun' },
  'yu-ji': { ...(yuJiQun as GeneralFileData), kingdom: 'Qun' },
  'yuan-shao': { ...(yuanShaoQun as GeneralFileData), kingdom: 'Qun' },
  'zhang-jiao': { ...(zhangJiaoQun as GeneralFileData), kingdom: 'Qun' },
  'zuo-ci': { ...(zuoCiQun as GeneralFileData), kingdom: 'Qun' },
};
