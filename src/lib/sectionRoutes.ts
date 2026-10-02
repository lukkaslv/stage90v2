export type SectionId = 'all-releases' | 'top-releases' | 'daily-top-15' | 'new-names' | 'reviews' | 'media-reviews' | 'author-picks' | 'author-comments';

export const sectionPaths: Record<SectionId, string> = {
  'all-releases': '/releases',
  'top-releases': '/top-releases',
  'daily-top-15': '/top-15',
  'new-names': '/new-names',
  reviews: '/reviews',
  'media-reviews': '/media-reviews',
  'author-picks': '/author-picks',
  'author-comments': '/author-comments',
};

export const sectionTitles: Record<SectionId, string> = {
  'all-releases': 'ყველა რელიზი',
  'top-releases': 'ყველა დროის ტოპ რელიზები',
  'daily-top-15': 'ბოლო 24 საათის ტოპ-15',
  'new-names': 'ახალი სახელები',
  reviews: 'ახალი რეცენზიები რელიზებზე',
  'media-reviews': 'მედიის რეცენზიები',
  'author-picks': 'ავტორების რჩეული',
  'author-comments': 'ავტორების კომენტარები',
};
