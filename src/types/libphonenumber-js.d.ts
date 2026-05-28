// `libphonenumber-js` ships example phone numbers but no type declaration for
// the `/mobile/examples` subpath. The module maps an ISO-3166 alpha-2 country
// code to an example national (significant) number string, e.g. `IN` →
// `"8123456789"`. Used to render a country-appropriate phone placeholder.
declare module "libphonenumber-js/mobile/examples" {
  const examples: Record<string, string>;
  export default examples;
}
