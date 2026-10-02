export type SectionId = 'all-releases' | 'new-names' | 'reviews' | 'media-reviews' | 'author-picks' | 'author-comments';

export const sectionPaths: Record<SectionId, string> = {
  'all-releases': '/releases',
  'new-names': '/new-names',
  reviews: '/reviews',
  'media-reviews': '/media-reviews',
  'author-picks': '/author-picks',
  'author-comments': '/author-comments',
};

export const sectionTitles: Record<SectionId, string> = {
  'all-releases': 'ყველა რელიზი',
  'new-names': 'ახალი სახელები',
  reviews: 'ახალი რეცენზიები რელიზებზე',
  'media-reviews': 'მედიის რეცენზიები',
  'author-picks': 'ავტორების რჩეული',
  'author-comments': 'ავტორების კომენტარები',
};
