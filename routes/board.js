const { Router } = require("express");
const { Board, User, Like } = require("../models");
const {
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
} = require("../middlewares");

const router = Router();

// 게시글 전체 조회
router.get("/", async (req, res, next) => {
  try {
    // 세션 확인(401 error)
    if (!req.session.passport) {
      throw new Unauthorized("로그인 후 이용 가능합니다.");
    }

    const nickname = req.session.passport.user.nickname;
    const board = await Board.find({}).lean();

    if (board.length === 0) {
      throw new NotFound("등록된 게시글을 찾을 수 없습니다."); // 404 에러
    }

    // 게시글 좋아요 관련 및 res 관련
    let boardData = [];
    for (const data of board) {
      let likes = await Like.find({ boardId: data.boardId }).lean();
      // 좋아요수
      const likesCount = likes.reduce(
        (total, like) => total + like.fromUser.length,
        0
      );

      boardData.push({
        nickname: data.nickname,
        title: data.title,
        contents: data.contents,
        createAt: data.createAt,
        boardId: data.boardId,
        likes: likesCount,
        isLikes:
          likes.length !== 0 ? likes[0].fromUser.includes(nickname) : false, // 본인이 좋아요를 눌렀는지
        listLikes: likes.length !== 0 ? likes[0].fromUser : [], // 좋아요 누른 리스트
      });
    }

    // 페이지네이션
    const page = Number(req.query.page || 1); // 현재 페이지
    const perPage = Number(req.query.perPage || 10); // 페이지 당 게시글 수
    const total = await Board.countDocuments({}); // 총 Board 수 세기
    const totalPage = Math.ceil(total / perPage);

    const { sortName } = req.body;

    // 기본은 최신순
    let resultBoard = boardData
      .sort((a, b) => b.boardId - a.boardId)
      .slice(perPage * (page - 1), perPage * (page - 1) + perPage);

    // body에 좋아요순 입력 시
    if (sortName === "좋아요순") {
      resultBoard = boardData
        .sort((a, b) => b.likes - a.likes)
        .slice(perPage * (page - 1), perPage * (page - 1) + perPage);
    }

    res.status(200).json({
      error: null,
      totalPage,
      data: resultBoard,
    });
  } catch (e) {
    next(e);
  }
});

// 게시글 조회
router.get("/:boardId", async (req, res, next) => {
  try {
    // 세션 확인(401 error)
    if (!req.session.passport) {
      throw new Unauthorized("로그인 후 이용 가능합니다.");
    }

    const { boardId } = req.params;
    const nickname = req.session.passport.user.nickname;
    const board = await Board.findOne({ boardId }).lean();

    if (!board) {
      throw new NotFound("해당 게시글이 존재하지 않습니다."); // 404 에러
    }

    let boardData = [];
    let likes = await Like.find({ boardId }).lean();
    const likesCount = likes.reduce(
      // 좋아요 수
      (total, like) => total + like.fromUser.length,
      0
    );

    boardData.push({
      nickname: board.nickname,
      title: board.title,
      contents: board.contents,
      createAt: board.createAt,
      boardId: board.boardId,
      likes: likesCount,
      isLikes:
        likes.length !== 0 ? likes[0].fromUser.includes(nickname) : false, // 본인이 좋아요를 누른 게시글인지 true, false
      listLikes: likes.length !== 0 ? likes[0].fromUser : [],
    });

    res.status(200).json({
      error: null,
      data: boardData,
    });
  } catch (e) {
    next(e);
  }
});

// 게시글 작성
router.post("/", async (req, res, next) => {
  try {
    // 세션 확인(401 error)
    if (!req.session.passport) {
      throw new Unauthorized("로그인 후 이용 가능합니다.");
    }

    const nickname = req.session.passport.user.nickname;
    const { title, contents } = req.body;

    if (!title || !contents) {
      throw new BadRequest("입력되지 않은 내용이 있습니다."); // 400 에러
    }
    if (title.replace(/ /g, "") == "") {
      throw new BadRequest("공백은 제목으로 사용 불가능합니다."); // 400 에러
    }
    if (contents.replace(/ /g, "") == "") {
      throw new BadRequest("공백은 내용으로 사용 불가능합니다."); // 400 에러
    }

    const board = await Board.create({
      nickname,
      title,
      contents,
    });

    res.status(201).json({
      error: null,
      message: "게시글이 작성되었습니다.",
      data: {
        nickname: board.nickname,
        boardId: board.boardId,
        title: board.title,
        contents: board.contents,
        createdAt: board.createdAt,
      },
    });
  } catch (e) {
    next(e);
  }
});

// 게시판 수정
router.put("/:boardId", async (req, res, next) => {
  try {
    if (!req.session.passport) {
      throw new Unauthorized("로그인 후 이용 가능합니다.");
    }

    const boardId = req.params.boardId;
    const { title, contents } = req.body;
    const nickname = req.session.passport.user.nickname;

    if (!title || !contents) {
      throw new BadRequest("입력되지 않은 내용이 있습니다."); // 400 에러
    }
    if (title.trim().length === 0) {
      throw new BadRequest("공백은 제목으로 사용 불가능합니다."); // 400 에러
    }
    if (contents.trim().length === 0) {
      throw new BadRequest("공백은 내용으로 사용 불가능합니다."); // 400 에러
    }

    const findBoard = await Board.findOne({ boardId }).lean();
    if (!findBoard) {
      throw new NotFound(`${boardId}번 게시글을 찾을 수 없습니다.`); // 404
    }
    if (nickname !== findBoard.nickname) {
      throw new Forbidden("접근할 수 없습니다.");
    }
    const board = await Board.findOneAndUpdate(
      { boardId },
      { title, contents },
      { runValidators: true, new: true }
    ).lean();

    res.status(200).json({
      err: null,
      message: "게시글이 수정되었습니다.",
      data: {
        nickname: board.nickname,
        boardId: board.boardId,
        title: board.title,
        contents: board.contents,
        createdAt: board.createdAt,
      },
    });
  } catch (e) {
    next(e);
  }
});

// 게시글 삭제
router.delete("/:boardId", async (req, res, next) => {
  try {
    if (!req.session.passport) {
      throw new Unauthorized("로그인 후 이용 가능합니다.");
    }

    const boardId = req.params.boardId;
    const nickname = req.session.passport.user.nickname;

    const findBoard = await Board.findOne({ boardId }).lean();
    if (!findBoard) {
      throw new NotFound(`${boardId}번 게시글을 찾을 수 없습니다.`);
    }
    if (nickname !== findBoard.nickname) {
      throw new Forbidden("접근할 수 없습니다.");
    }
    await Board.deleteOne({ boardId }).lean();
    await Like.findOneAndDelete({ boardId }).lean(); // 게시글의 좋아요 데이터도 삭제

    res.status(200).json({
      err: null,
      message: `${nickname}님의 ${boardId}번 게시글을 삭제했습니다.`,
    });
  } catch (e) {
    next(e);
  }
});

// 좋아요
router.post("/:boardId/likes", async (req, res, next) => {
  try {
    if (!req.session.passport) {
      throw new Unauthorized("로그인 후 이용 가능합니다.");
    }

    const nickname = req.session.passport.user.nickname; // 누르는 사람(세션의 닉네임으로 넣음)
    const boardId = req.params.boardId; // 게시글 번호

    const exists = await Board.findOne({ boardId }).lean();
    if (!exists) {
      throw new NotFound("해당 게시글이 존재하지 않습니다."); // 404 에러
    }

    const likes = await Like.findOne({ boardId }).lean();

    // Like에 해당 게시글 정보가 없을 경우에는 데이터를 새로 넣어야 함
    if (!likes) {
      await Like.create({ fromUser: nickname, boardId });

      res.status(200).json({
        error: null,
        message: `${nickname}님이 ${boardId}번 게시글을 좋아합니다.`,
      });
      return;
    }

    const existsLike = await Like.findOne({
      fromUser: nickname,
      boardId,
    }).lean();

    if (existsLike) {
      // 이미 좋아요를 누른 게시글일 때
      const index = likes.fromUser.indexOf(nickname);
      if (index === -1) {
        throw new BadRequest("좋아요를 누르지 않았습니다.");
      }

      likes.fromUser.splice(index, 1);
      await Like.updateOne({ boardId }, { fromUser: likes.fromUser });

      return res.status(200).json({
        error: null,
        message: `${nickname}님이 ${boardId}번 게시글 좋아요를 취소했습니다.`,
      });
    } else {
      // 좋아요를 누르지 않은 게시글일 때
      likes.fromUser.push(nickname);
      await Like.updateOne({ boardId }, { fromUser: likes.fromUser });

      return res.status(200).json({
        error: null,
        message: `${nickname}님이 ${boardId}번 게시글을 좋아합니다.`,
      });
    }
  } catch (e) {
    next(e);
  }
});

// 게시글 검색
router.get("/search/result", async (req, res, next) => {
  try {
    const { option, keyword } = req.query;
    let board = [];

    // 닉네임으로 검색
    if (option === "nickname") {
      board = await Board.find({
        nickname: new RegExp(keyword, "i"),
      }).lean();
    }

    // 제목으로 검색
    if (option === "title") {
      board = await Board.find({
        title: new RegExp(keyword, "i"),
      }).lean();
    }

    // 내용으로 검색
    if (option === "contents") {
      board = await Board.find({
        contents: new RegExp(keyword, "i"),
      }).lean();
    }

    // 제목 + 내용으로 검색
    if (option === "titleContents") {
      board = await Board.find({
        $or: [
          {
            title: new RegExp(keyword, "i"),
          },
          {
            contents: new RegExp(keyword, "i"),
          },
        ],
      }).lean();
    }

    res.status(200).json({
      error: null,
      data: board,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
