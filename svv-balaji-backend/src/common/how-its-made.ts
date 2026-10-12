import { IsUrl, MaxLength } from 'class-validator';

/**
 * "How this is made" link on a product or recipe - a YouTube or Instagram
 * video, a blog post, anything on the web. Shown to customers and retailers
 * on the product page. Only http(s), so a stored link can never run script.
 */
export function IsHowItsMadeUrl(): PropertyDecorator {
  return (target, key) => {
    IsUrl(
      { protocols: ['http', 'https'], require_protocol: true },
      { message: 'Enter a full web link starting with https://' },
    )(target, key);
    MaxLength(500)(target, key);
  };
}
