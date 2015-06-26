package com.atlassian.plugins.guile.rest;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class GetBoardsModel {

	@XmlElement(name = "boards")
	private BoardModel[] boards;
	public BoardModel[] getBoards() { return boards; }
	public void setBoards(BoardModel[] value) { boards = value; }

	public GetBoardsModel() {
	}

	public GetBoardsModel(BoardModel[] boards) {
		this.boards = boards;
	}

}
