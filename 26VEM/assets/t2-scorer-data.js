window.VEMT2ScorerData={
  "version": 1,
  "asOf": "2026-11-22",
  "core": {
    "version": "v1",
    "grade": "A",
    "anchorsMatched": 48,
    "anchorsTotal": 48,
    "historyWithinTolerance": 18,
    "historyTotal": 18,
    "tolerance": 0.01,
    "maxDelta": 0.00473681834485,
    "gatesMatched": 4,
    "gatesTotal": 4,
    "ods": "legacy"
  },
  "coverage": {
    "officialBeds": 2,
    "externalBeds": 7,
    "testBeds": 2,
    "worksetsCovered": 80,
    "worksetsExpected": 80,
    "referenceControls": 440,
    "referenceScore": 50,
    "dryrunsPassed": 10,
    "dryrunsExpected": 10
  },
  "boards": [
    {
      "id": "T2A",
      "title": "胚胎插值",
      "visible": [
        "E6.75",
        "E7.25",
        "E8.0"
      ],
      "testVisible": [
        "E6.75",
        "E7.25",
        "E7.5",
        "E8.0"
      ],
      "validationTarget": "E7.5",
      "testTarget": "E7.75",
      "officialBeds": 1,
      "externalBeds": 4,
      "testBeds": 1,
      "worksetsCovered": 40,
      "worksetsExpected": 40,
      "dryrunsPassed": 5,
      "dryrunsExpected": 5,
      "records": {
        "full": 324,
        "expressionOnly": 230,
        "notApplicable": 94,
        "notRun": 32
      },
      "mock": {
        "correct": 35,
        "judged": 40,
        "eligible": 97
      }
    },
    {
      "id": "T2B",
      "title": "心脏外推",
      "visible": [
        "E8.25 late",
        "E8.5",
        "E8.75",
        "E9.5"
      ],
      "testVisible": [
        "E8.25 late",
        "E8.5",
        "E8.75",
        "E9.5",
        "E10.5"
      ],
      "validationTarget": "E10.5",
      "testTarget": "E12.5",
      "officialBeds": 1,
      "externalBeds": 3,
      "testBeds": 1,
      "worksetsCovered": 40,
      "worksetsExpected": 40,
      "dryrunsPassed": 5,
      "dryrunsExpected": 5,
      "records": {
        "full": 150,
        "expressionOnly": 330,
        "notApplicable": 136,
        "notRun": 64
      },
      "mock": {
        "correct": 47,
        "judged": 54,
        "eligible": 79
      }
    }
  ],
  "metricGroups": [
    {
      "title": "表达变化",
      "metrics": [
        "DES",
        "DCS"
      ],
      "weight": 25
    },
    {
      "title": "状态分布",
      "metrics": [
        "MMD",
        "CSS"
      ],
      "weight": 25
    },
    {
      "title": "形状与尺寸",
      "metrics": [
        "SDD",
        "ODS",
        "TSR"
      ],
      "weight": 25
    },
    {
      "title": "局部组织",
      "metrics": [
        "NFS"
      ],
      "weight": 25
    }
  ],
  "sources": [
    {
      "label": "评分核心发布记录",
      "sha256": "777d2736bcec4af794d15d1170b0a82eb9e4e0d839c8d20e2c2342fa381bbea5"
    },
    {
      "label": "三块验证板回归",
      "sha256": "1733bdb69a8ed4003c1af43041ab4f536d3dbfd159072e1d598ae4ebb2339014"
    },
    {
      "label": "冻结回归门槛",
      "sha256": "70954d0993a6fdfe4f498333e67b59a8b1131cb0ac40a04650a55ee62c269f4b"
    },
    {
      "label": "考场登记",
      "sha256": "c9476965de0a686a5dcf16c0019cd1d2f657481b9b22763c36cb9dea32416e8a"
    },
    {
      "label": "工作集覆盖审计",
      "sha256": "be6ce1c0df5779d2e31aa328d451825327156fe7daa25047b07051013d0f4a4c"
    },
    {
      "label": "两板 TEST 干跑验收",
      "sha256": "cb1b777c05c2ab08dd73b9179cd73c858644296177edde11b1996bb4eb87a00d"
    },
    {
      "label": "官网验证与测试目标",
      "sha256": "b03b6dea5f74e159a37c1261b330d56e5f8ee199f6014247c5b4c5402c01f0d9"
    },
    {
      "label": "T2A 留一族模拟考",
      "sha256": "248abbcb07a5a2bb57d34d7e555848accab8f4a2568d75c655f12d684264dc5f"
    },
    {
      "label": "T2A 开发评估成绩汇总表",
      "sha256": "89a866baf6086e9726c64e037a8dfcddb7579a5add1d146ad6cdfd068d223e5a"
    },
    {
      "label": "T2B 留一族模拟考",
      "sha256": "65048b52b9a9a017a79386e82fc34f465ccede760c05401b9434f7bb008d773a"
    },
    {
      "label": "T2B 开发评估成绩汇总表",
      "sha256": "85d9c70d85eb26d4b08f85f92cec0a0eaead405c12f36f88345ab2fa309deafc"
    }
  ]
};
