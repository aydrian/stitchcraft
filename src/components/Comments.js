import React from 'react'
import { StitchClient } from 'mongodb-stitch'

// Import typefaces
import 'typeface-montserrat'
import 'typeface-merriweather'

const stitchClient = new StitchClient('stitchcraft-ogeho')
const db = stitchClient.service('mongodb', 'mongodb-atlas').db('blog')

class Comments extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      comments: [],
      comment: '',
      author: ''
    }
    this.loadComments = this.loadComments.bind(this)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.handleAddComment = this.handleAddComment.bind(this)
  }

  handleInputChange (event) {
    const target = event.target
    const value = target.type === 'checkbox' ? target.checked : target.value
    const name = target.name

    this.setState({[name]: value})
  }

  loadComments () {
    db.collection('comments').find({postId: this.props.post.id}).then(comments => {
      this.setState({ comments })
    })
  }

  handleAddComment (event) {
    event.preventDefault()
    db.collection('comments')
      .insert({postId: this.props.post.id,
        owner_id: stitchClient.authedId(),
        comment: this.state.comment,
        author: this.state.author,
        timestamp: new Date()
      })
      .then(this.loadComments)
      .then(() => {
        this.setState({newComment: {
          comment: '',
          author: ''
        }})
      })
  }

  componentWillMount () {
    stitchClient.login().then(this.loadComments)
  }

  render () {
    return (
      <div className='comments'>
        <h2>Comments</h2>
        <hr />
        {this.state.comments.length === 0 && (
          <div>No comments yet. Be the first to add one!</div>
        )}
        {this.state.comments.map(comment => {
          return (<div key={comment._id.toString()}>
            {comment.comment}<br />
          By {comment.author} on {comment.timestamp ? comment.timestamp.toString() : ''}
          </div>)
        })}
        <hr />
        <label>
          Your Name:
          <input
            name='author'
            type='text'
            value={this.state.author}
            onChange={this.handleInputChange} />
        </label><br />
        <label>
          Add comment:
          <input
            name='comment'
            type='text'
            value={this.state.comment}
            onChange={this.handleInputChange} />
        </label><br />
        <input type='submit' onClick={this.handleAddComment} />
      </div>
    )
  }
}

export default Comments
