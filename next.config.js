/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  serverExternalPackages: ['pg', 'xlsx'],
};
