const { Schema } = require("mongoose");

const UserSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "설명이 아직 없습니다. 설명을 추가해주세요.",
  },
  createAt: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
  profileImg: {
    type: String,
    required: true,
    default: "default 프로필 이미지 url 추후 추가 예정",
  },
});

module.exports = UserSchema;
