with open('/home/faith/.bashrc', 'r') as f:
    lines = f.readlines()

skip_patterns = [
    'ANDROID_HOME',
    'ANDROID_SDK_ROOT',
    'JAVA_HOME',
    'platform-tools',
    'cmdline-tools/latest',
    '/emulator',
]
clean_lines = [line for line in lines if not any(p in line for p in skip_patterns)]

env_block = (
    '\n'
    '# Android SDK\n'
    'export ANDROID_HOME=$HOME/Android/Sdk\n'
    'export ANDROID_SDK_ROOT=$ANDROID_HOME\n'
    'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin\n'
    'export PATH=$PATH:$ANDROID_HOME/platform-tools\n'
    'export PATH=$PATH:$ANDROID_HOME/emulator\n'
    '\n'
    '# Java 17\n'
    'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64\n'
    'export PATH=$PATH:$JAVA_HOME/bin\n'
)

with open('/home/faith/.bashrc', 'w') as f:
    f.writelines(clean_lines)
    f.write(env_block)

print('bashrc updated successfully')
