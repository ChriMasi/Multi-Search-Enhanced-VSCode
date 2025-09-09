FROM node:20-slim

# パッケージインストール
RUN apt-get update -qq && \
    apt-get install -y \
        git \
        sudo \
    && rm -rf /var/lib/apt/lists/*

# ライブラリインストール
RUN npm install -g npm \
    && npm install -g vsce @vscode/test-electron generator-code yo typescript

# ユーザー設定
ARG USER="node"

# ワークスペース設定
WORKDIR /app

RUN mkdir -p /$USER/.npm-global
ENV NPM_CONFIG_PREFIX=/$USER/.npm-global
ENV PATH="/${USER}/.npm-global:${PATH}"

# パスワードなしでsudoを実行できるように設定
RUN echo "${USER}:${USER}" | chpasswd
RUN usermod -aG sudo $USER
RUN echo "${USER} ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

USER ${USER}
