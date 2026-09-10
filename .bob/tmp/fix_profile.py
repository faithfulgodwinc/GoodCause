with open('/home/faith/.profile', 'r') as f:
    content = f.read()

env_block = '''
# Android SDK
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator

# Java 17
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$JAVA_HOME/bin

# NVM (for non-interactive shells)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
'''

if 'ANDROID_HOME' not in content:
    with open('/home/faith/.profile', 'a') as f:
        f.write(env_block)
    print('Added env block to .profile')
else:
    print('.profile already has ANDROID_HOME')
