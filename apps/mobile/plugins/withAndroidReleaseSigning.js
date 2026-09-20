const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// 4by4-forhire release signing';

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('4by4 release signing requires a Groovy app/build.gradle file.');
    }

    let contents = gradleConfig.modResults.contents;
    if (contents.includes(MARKER)) {
      return gradleConfig;
    }

    const signingProperties = `${MARKER}
def releaseStoreFile = findProperty('RELEASE_STORE_FILE') ?: System.getenv('RELEASE_STORE_FILE')
def releaseStorePassword = findProperty('RELEASE_STORE_PASSWORD') ?: System.getenv('RELEASE_STORE_PASSWORD')
def releaseKeyAlias = findProperty('RELEASE_KEY_ALIAS') ?: System.getenv('RELEASE_KEY_ALIAS')
def releaseKeyPassword = findProperty('RELEASE_KEY_PASSWORD') ?: System.getenv('RELEASE_KEY_PASSWORD')
def releaseSigningConfigured = [releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword].every { it }
def releaseTaskRequested = gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') }
if (releaseTaskRequested && !releaseSigningConfigured) {
    throw new GradleException('Release signing requires RELEASE_STORE_FILE, RELEASE_STORE_PASSWORD, RELEASE_KEY_ALIAS, and RELEASE_KEY_PASSWORD.')
}

`;

    contents = contents.replace('android {', `${signingProperties}android {`);

    const signingConfigPattern = /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\}\n)(\s*\})/;
    if (!signingConfigPattern.test(contents)) {
      throw new Error('Unable to locate Android signingConfigs block.');
    }
    contents = contents.replace(
      signingConfigPattern,
      `$1        release {\n            if (releaseSigningConfigured) {\n                storeFile file(releaseStoreFile)\n                storePassword releaseStorePassword\n                keyAlias releaseKeyAlias\n                keyPassword releaseKeyPassword\n            }\n        }\n$2`,
    );

    const debugReleaseSigning = '            signingConfig signingConfigs.debug';
    const buildTypesStart = contents.indexOf('    buildTypes {');
    const releaseBlockStart = contents.indexOf('        release {', buildTypesStart);
    const debugSigningIndex = contents.indexOf(debugReleaseSigning, releaseBlockStart);
    if (buildTypesStart === -1 || releaseBlockStart === -1 || debugSigningIndex === -1) {
      throw new Error('Unable to locate Android release buildType signing configuration.');
    }
    contents =
      contents.slice(0, debugSigningIndex) +
      '            if (releaseSigningConfigured) signingConfig signingConfigs.release' +
      contents.slice(debugSigningIndex + debugReleaseSigning.length);

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
};
